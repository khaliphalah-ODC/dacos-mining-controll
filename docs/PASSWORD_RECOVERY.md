# Reset a forgotten local DACOS login password

The `.data/*.credential` files contain PostgreSQL service passwords, not DACOS
login passwords. Leave those files unchanged.

From the project root in your Bash terminal:

```bash
read -r -s -p 'New DACOS password: ' DACOS_RESET_PASSWORD
export DACOS_RESET_PASSWORD
./scripts/npm run reset:password
unset DACOS_RESET_PASSWORD
```

The password is hidden as you type. Use at least 12 characters and at most 72
UTF-8 bytes. Enter the email you originally registered when prompted. The command
resets that active account's password without changing its email or role, revokes
old sessions, clears local loopback login throttling and records an audit event.
Your new password is not printed or saved in source files.

You can leave the local application running. The command reuses project-local
PostgreSQL if it is already running, or starts/stops its own local instance.
It does not run migrations or change an external database. Only loopback database
URLs pointing to the local `dacos` database are accepted. It does not reactivate a
disabled account. If tables are missing, run the normal local dev bootstrap first.

After resetting, sign in again using the existing email and new password. If the
application is stopped, start it with `./scripts/npm run dev`.
