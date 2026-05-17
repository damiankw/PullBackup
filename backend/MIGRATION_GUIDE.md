# Production Migration Guide

## Problem
After adding audit logging and public key storage features, the production database is missing:
1. `audit_logs` table
2. `public_key_content` column in `ssh_keys` table

This causes SSH keys to appear empty in the UI.

## Solution
Run one of the migration methods below against your **production database**.

---

## Method 1: Python Migration Script (Recommended)

### For local database:
```bash
cd backend
python migrate_add_audit_and_public_key.py
```

### For custom database path:
```bash
python migrate_add_audit_and_public_key.py /path/to/pullbackup.db
```

### For microk8s pod:
```bash
# 1. Copy migration script to pod
kubectl cp backend/migrate_add_audit_and_public_key.py <pod-name>:/tmp/migrate.py

# 2. Execute migration
kubectl exec <pod-name> -- python /tmp/migrate.py /path/to/database/pullbackup.db
```

---

## Method 2: SQL Script (Direct Database Access)

If you have direct access to the SQLite database:

```bash
sqlite3 /path/to/pullbackup.db < backend/migration.sql
```

For microk8s:
```bash
# 1. Copy SQL to pod
kubectl cp backend/migration.sql <pod-name>:/tmp/migration.sql

# 2. Execute SQL
kubectl exec <pod-name> -- sqlite3 /path/to/database/pullbackup.db < /tmp/migration.sql
```

---

## Verification

After running the migration, verify:

1. **Check tables exist:**
   ```sql
   SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs';
   ```

2. **Check column exists:**
   ```sql
   PRAGMA table_info(ssh_keys);
   ```
   Should show `public_key_content` column.

3. **Verify SSH keys visible:**
   ```sql
   SELECT id, name, key_file_path FROM ssh_keys;
   ```

4. **Check UI:**
   - SSH Keys page should show your keys
   - Server edit page should show SSH key dropdown

---

## Important Notes

- ✅ **Your SSH key files are safe** - they're stored on disk, not in the database
- ✅ The migration is **idempotent** - safe to run multiple times
- ✅ Existing SSH keys will have `NULL` public_key_content (you can generate them via UI)
- ⚠️  No data will be lost - this only **adds** columns and tables

---

## Rollback (if needed)

If something goes wrong, you can rollback:

```sql
-- Remove audit_logs table
DROP TABLE IF EXISTS audit_logs;

-- Remove public_key_content column (requires table recreation)
-- SQLite doesn't support DROP COLUMN directly
```

## Next Steps

After migration succeeds:
1. Refresh your browser
2. SSH Keys page should show all your keys
3. Server dropdown should show SSH keys again
4. Audit logs will start tracking from now on
