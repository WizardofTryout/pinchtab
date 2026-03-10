//go:build windows

package bridge

func isChromePIDRunning(pid int) (bool, error) {
	_ = pid
	return false, nil
}
