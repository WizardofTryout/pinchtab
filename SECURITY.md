# Security Policy

## Supported Versions

We currently support the following versions of Pinchtab with security updates:

| Version | Supported          |
| ------- | ------------------ |
| v0.5.x  | :white_check_mark: |
| < v0.5  | :x:                |

## Reporting a Vulnerability

We take the security of our browser automation bridge seriously. If you believe you have found a security vulnerability, please do not report it via a public GitHub issue.

Instead, please report vulnerabilities privately by:

1.  Opening a **Private Vulnerability Report** on GitHub (if available for this repo).
2.  Or emailing the maintainer directly at [INSERT EMAIL ADDRESS].

Please include:
- A description of the vulnerability.
- Steps to reproduce (proof of concept).
- Potential impact.

## Secret Management

To prevent the accidental exposure of sensitive information, we adhere to the following practices:

1.  **Environment Variables:** All API keys, tokens, and credentials MUST be stored in a `.env` file or passed as environment variables.
2.  **No Committing Secrets:** The `.env` file is included in `.gitignore` and must never be committed to version control. Use `.env.example` as a template for local setup.
3.  **Automated Audit:** We use a custom security audit script (`scripts/security_audit.py`) to scan for potential secrets. This script runs as a pre-commit hook.
4.  **Log Masking:** Developers must ensure that sensitive data is masked or omitted from application logs.

If you accidentally commit a secret:
1.  **Rotate the secret immediately.**
2.  **Remove the secret from Git history** using tools like `git filter-repo` or `BFG Repo-Cleaner`.
