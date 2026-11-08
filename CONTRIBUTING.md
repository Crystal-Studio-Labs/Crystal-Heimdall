# 🛠️ Contributing to Crystal Heimdall

<div align="center">

[![Contributing Guide](https://img.shields.io/badge/Contributing-GUIDELINES-10b981?style=for-the-badge&logo=github&logoColor=10b981&labelColor=070a0f)](https://github.com/Crystal-Studio-Labs/Crystal-Heimdall)
[![Code Style](https://img.shields.io/badge/Code%20Style-INDUSTRIAL%20BRUTALISM-06b6d4?style=for-the-badge&labelColor=070a0f)](./ARCHITECTURE.md)
[![Verification](https://img.shields.io/badge/Verification-39%20SMOKE%20%2B%2043%20PENTEST-f59e0b?style=for-the-badge&labelColor=070a0f)](./README.md)

</div>

> Thank you for contributing to **Crystal Heimdall 2.0**!  
> This document details standards, workflows, and quality requirements for engineers contributing to the Crystal Studio Labs reliability sentinel.

---

## 🏛️ Engineering Philosophy & Aesthetic Constraints

1. **Strict Industrial Brutalism (Zero Border Radius):**
   * Every card, button, modal, badge, input, and tooltip must adhere to `border-radius: 0px !important`.
   * Never use rounded edges (`rounded`, `rounded-md`, `rounded-lg`).
   * Heavy 3D mechanical offset shadows (`shadow-[4px_4px_0_0_#000]` or `shadow-[6px_6px_0_0_#10b981]`).
   * Monospace typography (`Space Mono`, `JetBrains Mono`) for all diagnostic meters, counters, and telemetry data.

2. **Zero Third-Party Telemetry Bloat:**
   * No third-party analytics trackers, cookies, or remote bloat.
   * Internal telemetry uses native standard libraries and lightweight LibSQL tables.

3. **Drive D: Storage Enforcement Policy:**
   * All development tools, package caches, and build artifacts must reside on Drive D: (`D:\npm-cache`, `D:\Projects`).
   * Never install developer caches into the Windows OS `C:` drive.

---

## 🔄 Development & Branching Workflow

1. **Fork or Branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Install Dependencies:**
   ```bash
   npm ci
   ```

3. **Run Local Development Server:**
   ```bash
   npm run dev
   ```
   Access the local status page at `http://localhost:3030`.

4. **Run Verification Suites:**
   Every Pull Request must pass the complete dual automated verification suite before review:
   ```powershell
   # 1. Run all 39 subsystem smoke tests
   node test-smoke.mjs

   # 2. Run all 43 security and penetration tests
   node test-pentest.mjs

   # 3. Verify zero-error production build
   npm run build
   ```

---

## 🔒 Security & Code Standards

* **No Master Passwords:** Operator authentication is strictly RFC 6238 TOTP. Never introduce database passwords or bypass backdoors.
* **Timing-Safe Equality:** Any token or hash validation must use `crypto.timingSafeEqual()`.
* **Parameterized Queries:** All SQL queries to LibSQL/SQLite must use parameterized placeholders (`?`). Never concatenate raw strings into SQL statements.
* **Clean Access Control:** Ensure public users never have access to operator console routes or administrative actions.

---

## 📄 License & Attribution

By submitting a contribution to this repository, you agree that your contribution will be licensed under the project's [MIT License](./LICENSE).  
Copyright &copy; 2026 **Crystal Studio Labs**.
