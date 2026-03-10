// profile_lock.go handles stale Chrome profile lock recovery.
//
// When a container restarts (or Chrome crashes), Chrome's SingletonLock,
// SingletonSocket, and SingletonCookie files may be left behind in the profile
// directory. On next startup Chrome sees these and refuses to launch with
// "The profile appears to be in use by another Chromium process".
//
// This code detects that error, checks whether the owning process is actually
// still running (via PID probe and process listing), and removes the stale
// lock files if it's safe to do so. It retries Chrome startup once after
// clearing the locks.

package bridge

import (
	"bytes"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

var chromeProfileProcessLister = findChromeProfileProcesses
var chromePIDIsRunning = isChromePIDRunning

var chromeSingletonFiles = []string{
	"SingletonLock",
	"SingletonSocket",
	"SingletonCookie",
}

var chromeProfileLockPIDPattern = regexp.MustCompile(`(?:Chromium|Chrome) process \((\d+)\)`)

type chromeProfileProcess struct {
	PID     string
	Command string
}

func isChromeProfileLockError(msg string) bool {
	if msg == "" {
		return false
	}
	return strings.Contains(msg, "The profile appears to be in use by another Chromium process") ||
		strings.Contains(msg, "The profile appears to be in use by another Chrome process") ||
		strings.Contains(msg, "process_singleton")
}

func clearStaleChromeProfileLock(profileDir, errMsg string) (bool, error) {
	if strings.TrimSpace(profileDir) == "" {
		return false, nil
	}

	if pid, ok := extractChromeProfileLockPID(errMsg); ok {
		running, err := chromePIDIsRunning(pid)
		if err != nil {
			slog.Warn("failed to probe chrome lock pid; falling back to process listing", "profile", profileDir, "pid", pid, "err", err)
		} else if running {
			slog.Warn("chrome profile lock appears active; leaving singleton files in place", "profile", profileDir, "pid", pid)
			return false, nil
		}
	}

	processes, err := chromeProfileProcessLister(profileDir)
	if err != nil {
		if _, ok := extractChromeProfileLockPID(errMsg); ok {
			slog.Warn("profile process listing unavailable; proceeding with stale lock cleanup based on lock pid", "profile", profileDir, "err", err)
		} else {
			return false, err
		}
	}
	if len(processes) > 0 {
		pids := make([]string, 0, len(processes))
		for _, proc := range processes {
			pids = append(pids, proc.PID)
		}
		slog.Warn("chrome profile lock appears active; leaving singleton files in place", "profile", profileDir, "pids", strings.Join(pids, ","))
		return false, nil
	}

	removed := false
	for _, name := range chromeSingletonFiles {
		path := filepath.Join(profileDir, name)
		if _, err := os.Lstat(path); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return false, fmt.Errorf("inspect %s: %w", path, err)
		}
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return removed, fmt.Errorf("remove %s: %w", path, err)
		}
		removed = true
	}

	return removed, nil
}

func extractChromeProfileLockPID(msg string) (int, bool) {
	if msg == "" {
		return 0, false
	}
	match := chromeProfileLockPIDPattern.FindStringSubmatch(msg)
	if len(match) != 2 {
		return 0, false
	}
	pid := 0
	for _, ch := range match[1] {
		pid = pid*10 + int(ch-'0')
	}
	if pid <= 0 {
		return 0, false
	}
	return pid, true
}

func findChromeProfileProcesses(profileDir string) ([]chromeProfileProcess, error) {
	if strings.TrimSpace(profileDir) == "" {
		return nil, nil
	}

	cmd := exec.Command("ps", "-axo", "pid=,args=")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("list chrome processes: %w", err)
	}

	return parseChromeProfileProcesses(out, profileDir), nil
}

func parseChromeProfileProcesses(out []byte, profileDir string) []chromeProfileProcess {
	if len(out) == 0 || strings.TrimSpace(profileDir) == "" {
		return nil
	}

	needleEquals := "--user-data-dir=" + profileDir
	needleSpace := "--user-data-dir " + profileDir
	lines := bytes.Split(out, []byte{'\n'})
	processes := make([]chromeProfileProcess, 0)

	for _, rawLine := range lines {
		line := strings.TrimSpace(string(rawLine))
		if line == "" || (!strings.Contains(line, needleEquals) && !strings.Contains(line, needleSpace)) {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		processes = append(processes, chromeProfileProcess{
			PID:     fields[0],
			Command: strings.TrimSpace(strings.TrimPrefix(line, fields[0])),
		})
	}

	return processes
}
