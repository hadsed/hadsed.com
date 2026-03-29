# D1 User Table Setup Plan

## Goal
Set up the Cloudflare D1 database for hadsed.com user management and verify the CLI works.

## Prerequisites
- Cloudflare account with D1 access
- wrangler CLI authenticated
- Python 3.8+ with click and requests

## Steps

### 1. Create D1 Database
```bash
cd ~/projects/hadsed.com
wrangler d1 create hadsed-users
```
Note the database ID from the output.

### 2. Create wrangler.toml (if not exists)
```toml
name = "hadsed-com"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "hadsed-users"
database_id = "<YOUR_DATABASE_ID>"
```

### 3. Set Environment Variables
Either export these or add to ~/.zshrc:
```bash
export CLOUDFLARE_API_TOKEN="<your-token>"
export CLOUDFLARE_ACCOUNT_ID="<your-account-id>"
export D1_DATABASE_ID="<database-id-from-step-1>"
```

### 4. Install Python Dependencies
```bash
cd ~/projects/hadsed.com/scripts
pip install -r requirements.txt
```

### 5. Initialize the Table
```bash
./manage_users.py init
```

### 6. Test Commands
```bash
# Add a test user (private by default)
./manage_users.py add --username testuser --email test@example.com --display-name "Test User"

# List users
./manage_users.py list

# Get the user
./manage_users.py get --id 1

# Check stats
./manage_users.py stats

# Update the user
./manage_users.py update --id 1 --bio "This is a test bio"

# Verify schema
./manage_users.py schema
```

### 7. Test the Safety Checks
Try running `make-public` and verify:
- Warning banner appears
- First confirmation prompt works
- "MAKE PUBLIC" exact text required
- Agent permission check appears
- Can abort at any stage

```bash
./manage_users.py make-public --id 1
# (abort at first prompt to test)
```

### 8. Cleanup Test Data
```bash
./manage_users.py delete --id 1
```

## Schema Reference

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    is_public INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

## Notes
- All users are PRIVATE by default (is_public = 0)
- `make-public` has triple confirmation to prevent accidental exposure
- `bulk-private` is the emergency lockdown command
