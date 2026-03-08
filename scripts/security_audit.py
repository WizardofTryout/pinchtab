#!/usr/bin/env python3
import os
import re
import sys
import math

# Patterns to look for - focus on actual assignment of secrets
SECRET_PATTERNS = [
    # Assignment patterns: key="secret", token: 'secret', etc.
    re.compile(r'(?:key|secret|password|token|api|auth|cred|login|pass)[\s:=]+["\']([a-zA-Z0-9\-_]{16,})["\']', re.IGNORECASE),
    re.compile(r'ghp_[a-zA-Z0-9]{36}'),  # GitHub personal access tokens
    re.compile(r'AIza[0-9A-Za-z-_]{35}'), # Google API Key
    re.compile(r'sk_live_[0-9a-zA-Z]{24}'), # Stripe live API key
]

# Files/Directories to ignore entirely
IGNORE_PATHS = [
    '.git',
    'node_modules',
    'dist',
    'build',
    'vendor',
    'go.sum',
    'package-lock.json',
    'scripts/security_audit.py',
    'internal/semantic/synonyms.go',
    'npm',
    'dashboard',
]

# Extensions to ignore for entropy checks (still scanned for patterns)
ENTROPY_IGNORE_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.sh', '.md', '.txt', '.json', '.go', '.html', '.css', '.tsx', '.ts', '.js']

def calculate_entropy(s):
    if not s:
        return 0
    entropy = 0
    for x in range(256):
        if len(s) == 0: continue
        p_x = float(s.count(chr(x)))/len(s)
        if p_x > 0:
            entropy += - p_x * math.log(p_x, 2)
    return entropy

def is_binary(filename):
    try:
        with open(filename, 'rb') as f:
            chunk = f.read(1024)
            return b'\0' in chunk
    except:
        return True

def scan_file(filepath):
    findings = []
    if is_binary(filepath):
        return findings

    # Ignore code and assets for entropy checks to reduce false positives
    should_ignore_entropy = any(filepath.endswith(ext) for ext in ENTROPY_IGNORE_EXTENSIONS)
    is_test_file = any(x in filepath.lower() for x in ["_test.go", ".test.ts", ".test.js", "tests/"])

    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for i, line in enumerate(f, 1):
                clean_line = line.strip()
                if not clean_line or clean_line.startswith('//') or clean_line.startswith('#') or clean_line.startswith('/*'):
                    continue

                # 1. Check for specific known patterns (Always active)
                for pattern in SECRET_PATTERNS:
                    matches = pattern.finditer(line)
                    for match in matches:
                        secret = match.group(0)
                        # Exclude some known dummy or example values
                        if any(x in secret.upper() for x in ["EXAMPLE", "SECRET-TOKEN-123", "YOUR-", "<APP"]):
                            continue
                        findings.append((i, secret, "Pattern Match"))

                # 2. Heuristic Entropy Check (only for config files or potential env-like files)
                # We skip this for main code files to avoid massive false positives
                if not should_ignore_entropy and not is_test_file and ('=' in line or ':' in line):
                    parts = re.split(r'[=:]', line, 1)
                    if len(parts) > 1:
                        potential_assignment = parts[1].strip().split('//')[0].strip().strip('",;\'')
                        # Check if it's a long random-looking string
                        if 20 < len(potential_assignment) < 128:
                            entropy = calculate_entropy(potential_assignment)
                            if entropy > 4.5:
                                # Mixed case and digits to look like a secret
                                if re.search(r'[A-Z]', potential_assignment) and re.search(r'[a-z]', potential_assignment) and re.search(r'\d', potential_assignment):
                                    # Avoid common non-secret strings
                                    if not potential_assignment.startswith(('http', 'path', 'sha', '0x')):
                                        if not any(x in potential_assignment.upper() for x in ["EXAMPLE", "TEST", "TOKEN", "SECRET"]):
                                            findings.append((i, potential_assignment, f"High Entropy ({entropy:.2f})"))
    except Exception as e:
        pass

    return findings

def main():
    root_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    exit_code = 0

    print(f"--- Security Audit: Scanning {root_dir} ---")

    for root, dirs, files in os.walk(root_dir):
        # Apply ignores
        dirs[:] = [d for d in dirs if d not in IGNORE_PATHS]
        
        for file in files:
            if file in IGNORE_PATHS or any(p in root for p in IGNORE_PATHS):
                continue
            
            filepath = os.path.join(root, file)
            findings = scan_file(filepath)
            if findings:
                print(f"\n[!] Findings in {filepath}:")
                for line_num, secret, reason in findings:
                    obfuscated = secret[:4] + "*" * (max(0, len(secret)-8)) + secret[-4:] if len(secret) > 8 else "****"
                    print(f"  Line {line_num}: {reason} - {obfuscated}")
                exit_code = 1

    if exit_code == 0:
        print("\n✅ Security Audit Passed: No sensitive secrets detected.")
    else:
        print("\n❌ Security Audit Failed: Potential secrets detected.")
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
