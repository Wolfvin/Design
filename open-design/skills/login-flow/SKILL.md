---
name: login-flow
description: Mobile login and authentication flow screens
od:
  mode: prototype
  platform: mobile
  outputFormat: file-edit
  stackCompatibility: both
triggers:
  - login
  - sign in
  - 注册登录
  - 登录注册
  - 手机号登录
  - 验证码登录
  - 密码登录
---

<!-- MIGRATED: output changed from <artifact> to <file-edit> -->

# Login Flow Skill

A skill for generating mobile-first login and authentication screens. Use this when the user wants a sign-in experience for a mobile app, including phone + SMS verification, password-based login, and social SSO options.

## Workflow

1. **Read reference files first** (see below)
2. **Clarify auth method**: phone/SMS, password, or social SSO
3. **Checklist gate** — verify P0 items before emitting `<file-edit>`
4. **Build the component files** with proper states (default, loading, error)
5. **Wrap in `<file-edit>` tags** with explicit file paths

## Side Files

- `references/checklist.md` — P0/P1 acceptance criteria

## Output

Emit `<file-edit>` tags for the login screen component and its styles:

```
<file-edit path="src/components/auth/LoginForm.tsx">
import React, { useState } from 'react';
import styles from './LoginForm.module.css';
// ... component code with proper states
</file-edit>

<file-edit path="src/components/auth/LoginForm.module.css">
/* Mobile-first styles with design tokens */
.form { /* ... */ }
.input { /* ... */ }
.error { color: var(--error); }
</file-edit>
```

The component implements:
- Labels above inputs (never placeholder-only)
- Password field with show/hide toggle
- Social SSO buttons with SVG icons
- Error states below fields
- Loading spinner in primary CTA
- Touch targets minimum 44px

## Mobile-First Constraints

- Viewport: 375px wide (iPhone standard)
- No horizontal scroll
- Safe area insets for notched devices
- Input keyboards: `tel` for phone, `password` for password fields
