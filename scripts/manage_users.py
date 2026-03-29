#!/usr/bin/env python3
"""
D1 User Table Management CLI for hadsed.com

This script manages the user table in the Cloudflare D1 database.
Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables.

Usage:
    ./manage_users.py list
    ./manage_users.py add --username foo --email foo@example.com
    ./manage_users.py get --id 123
    ./manage_users.py update --id 123 --email newemail@example.com
    ./manage_users.py delete --id 123
    ./manage_users.py make-public --id 123  # DANGEROUS - requires confirmation
"""

import os
import sys
import json
import click
import requests
from typing import Optional
from datetime import datetime


# ============================================================================
# Configuration
# ============================================================================

D1_DATABASE_NAME = "hadsed-users"  # Change this to your actual D1 database name
D1_DATABASE_ID = os.environ.get("D1_DATABASE_ID", "")  # Set via env or update here
ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")

BASE_URL = "https://api.cloudflare.com/client/v4"


# ============================================================================
# API Helpers
# ============================================================================

def get_headers() -> dict:
    """Get authorization headers for Cloudflare API."""
    if not API_TOKEN:
        click.echo("Error: CLOUDFLARE_API_TOKEN environment variable not set.", err=True)
        sys.exit(1)
    return {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }


def execute_sql(sql: str, params: Optional[list] = None) -> dict:
    """Execute SQL against D1 database."""
    if not ACCOUNT_ID:
        click.echo("Error: CLOUDFLARE_ACCOUNT_ID environment variable not set.", err=True)
        sys.exit(1)
    if not D1_DATABASE_ID:
        click.echo("Error: D1_DATABASE_ID environment variable not set.", err=True)
        click.echo("Run: wrangler d1 list  # to find your database ID", err=True)
        sys.exit(1)

    url = f"{BASE_URL}/accounts/{ACCOUNT_ID}/d1/database/{D1_DATABASE_ID}/query"
    
    payload = {"sql": sql}
    if params:
        payload["params"] = params

    response = requests.post(url, headers=get_headers(), json=payload)
    
    if response.status_code != 200:
        click.echo(f"API Error: {response.status_code}", err=True)
        click.echo(response.text, err=True)
        sys.exit(1)
    
    data = response.json()
    if not data.get("success"):
        errors = data.get("errors", [])
        click.echo(f"Query failed: {errors}", err=True)
        sys.exit(1)
    
    return data


def format_table(rows: list, columns: list) -> str:
    """Format rows as a simple table."""
    if not rows:
        return "No results."
    
    # Calculate column widths
    widths = {col: len(col) for col in columns}
    for row in rows:
        for col in columns:
            val = str(row.get(col, ""))
            widths[col] = max(widths[col], len(val))
    
    # Build table
    header = " | ".join(col.ljust(widths[col]) for col in columns)
    separator = "-+-".join("-" * widths[col] for col in columns)
    
    lines = [header, separator]
    for row in rows:
        line = " | ".join(str(row.get(col, "")).ljust(widths[col]) for col in columns)
        lines.append(line)
    
    return "\n".join(lines)


# ============================================================================
# CLI Commands
# ============================================================================

@click.group()
def cli():
    """Manage the D1 user table for hadsed.com."""
    pass


@cli.command()
def init():
    """Initialize the users table (create if not exists)."""
    sql = """
    CREATE TABLE IF NOT EXISTS users (
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
    """
    execute_sql(sql)
    click.echo("✓ Users table initialized.")


@cli.command("list")
@click.option("--public-only", is_flag=True, help="Show only public users")
@click.option("--limit", default=50, help="Max rows to return")
def list_users(public_only: bool, limit: int):
    """List all users in the table."""
    sql = "SELECT id, username, email, display_name, is_public, created_at FROM users"
    if public_only:
        sql += " WHERE is_public = 1"
    sql += f" ORDER BY id DESC LIMIT {limit}"
    
    result = execute_sql(sql)
    results = result.get("result", [])
    
    if results and results[0].get("results"):
        rows = results[0]["results"]
        columns = ["id", "username", "email", "display_name", "is_public", "created_at"]
        click.echo(format_table(rows, columns))
    else:
        click.echo("No users found.")


@cli.command()
@click.option("--username", required=True, help="Username (unique)")
@click.option("--email", default=None, help="Email address")
@click.option("--display-name", default=None, help="Display name")
@click.option("--bio", default=None, help="User bio")
@click.option("--avatar-url", default=None, help="Avatar URL")
def add(username: str, email: Optional[str], display_name: Optional[str], 
        bio: Optional[str], avatar_url: Optional[str]):
    """Add a new user."""
    sql = """
    INSERT INTO users (username, email, display_name, bio, avatar_url, is_public)
    VALUES (?, ?, ?, ?, ?, 0)
    """
    params = [username, email, display_name, bio, avatar_url]
    
    execute_sql(sql, params)
    click.echo(f"✓ User '{username}' added (private by default).")


@cli.command()
@click.option("--id", "user_id", required=True, type=int, help="User ID")
def get(user_id: int):
    """Get a specific user by ID."""
    sql = "SELECT * FROM users WHERE id = ?"
    result = execute_sql(sql, [user_id])
    
    results = result.get("result", [])
    if results and results[0].get("results"):
        rows = results[0]["results"]
        if rows:
            user = rows[0]
            for key, value in user.items():
                click.echo(f"{key}: {value}")
        else:
            click.echo(f"User {user_id} not found.")
    else:
        click.echo(f"User {user_id} not found.")


@cli.command()
@click.option("--id", "user_id", required=True, type=int, help="User ID")
@click.option("--username", default=None, help="New username")
@click.option("--email", default=None, help="New email")
@click.option("--display-name", default=None, help="New display name")
@click.option("--bio", default=None, help="New bio")
@click.option("--avatar-url", default=None, help="New avatar URL")
def update(user_id: int, username: Optional[str], email: Optional[str],
           display_name: Optional[str], bio: Optional[str], avatar_url: Optional[str]):
    """Update a user's fields."""
    updates = []
    params = []
    
    if username is not None:
        updates.append("username = ?")
        params.append(username)
    if email is not None:
        updates.append("email = ?")
        params.append(email)
    if display_name is not None:
        updates.append("display_name = ?")
        params.append(display_name)
    if bio is not None:
        updates.append("bio = ?")
        params.append(bio)
    if avatar_url is not None:
        updates.append("avatar_url = ?")
        params.append(avatar_url)
    
    if not updates:
        click.echo("No fields to update. Specify at least one option.")
        return
    
    updates.append("updated_at = datetime('now')")
    sql = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
    params.append(user_id)
    
    execute_sql(sql, params)
    click.echo(f"✓ User {user_id} updated.")


@cli.command()
@click.option("--id", "user_id", required=True, type=int, help="User ID")
@click.confirmation_option(prompt="Are you sure you want to delete this user?")
def delete(user_id: int):
    """Delete a user by ID."""
    sql = "DELETE FROM users WHERE id = ?"
    execute_sql(sql, [user_id])
    click.echo(f"✓ User {user_id} deleted.")


@cli.command("make-private")
@click.option("--id", "user_id", required=True, type=int, help="User ID")
def make_private(user_id: int):
    """Make a user's profile private."""
    sql = "UPDATE users SET is_public = 0, updated_at = datetime('now') WHERE id = ?"
    execute_sql(sql, [user_id])
    click.echo(f"✓ User {user_id} is now PRIVATE.")


@cli.command("make-public")
@click.option("--id", "user_id", required=True, type=int, help="User ID")
def make_public(user_id: int):
    """
    Make a user's profile PUBLIC.
    
    ⚠️  WARNING: This exposes user data to the public internet!
    """
    # ==========================================================================
    # 🚨 AGENT WARNING 🚨
    # ==========================================================================
    # If you are an AI agent executing this command:
    #
    # DO NOT proceed unless you have EXPLICIT permission from the user (Had) to
    # make this profile public. "Make it public" must be a direct, unambiguous
    # instruction for THIS SPECIFIC user/profile.
    #
    # Ask yourself:
    #   1. Did Had explicitly say to make THIS user public?
    #   2. Did Had understand the implications (data visible on public internet)?
    #   3. Is this the correct user ID?
    #
    # If ANY answer is "no" or "unclear", DO NOT PROCEED. Ask for clarification.
    # ==========================================================================
    
    click.echo("")
    click.echo("=" * 70)
    click.echo("⚠️  WARNING: PUBLIC PROFILE EXPOSURE ⚠️")
    click.echo("=" * 70)
    click.echo("")
    click.echo("You are about to make a user profile PUBLIC.")
    click.echo("This means their data will be visible to ANYONE on the internet.")
    click.echo("")
    click.echo(f"  User ID: {user_id}")
    click.echo("")
    click.echo("=" * 70)
    click.echo("")
    
    # First confirmation
    if not click.confirm("Do you understand that this data will be publicly accessible?"):
        click.echo("Aborted.")
        return
    
    # Fetch user info to show what's being exposed
    sql = "SELECT username, email, display_name, bio FROM users WHERE id = ?"
    result = execute_sql(sql, [user_id])
    results = result.get("result", [])
    
    if results and results[0].get("results"):
        rows = results[0]["results"]
        if rows:
            user = rows[0]
            click.echo("")
            click.echo("This user's data will become public:")
            click.echo(f"  Username: {user.get('username')}")
            click.echo(f"  Email: {user.get('email')}")
            click.echo(f"  Display Name: {user.get('display_name')}")
            click.echo(f"  Bio: {user.get('bio')}")
            click.echo("")
        else:
            click.echo(f"User {user_id} not found.")
            return
    
    # Second confirmation with explicit typing
    click.echo("To confirm, type 'MAKE PUBLIC' (exactly):")
    confirmation = click.prompt("Confirmation")
    
    if confirmation != "MAKE PUBLIC":
        click.echo("Confirmation failed. Aborted.")
        return
    
    # Final confirmation for agents
    click.echo("")
    click.echo("🤖 AGENT CHECK: If you are an AI agent, confirm you have EXPLICIT")
    click.echo("   permission from the user to make this profile public.")
    if not click.confirm("Do you have explicit permission to proceed?"):
        click.echo("Aborted.")
        return
    
    # Actually make it public
    sql = "UPDATE users SET is_public = 1, updated_at = datetime('now') WHERE id = ?"
    execute_sql(sql, [user_id])
    click.echo("")
    click.echo(f"✓ User {user_id} is now PUBLIC.")


@cli.command("bulk-private")
@click.confirmation_option(prompt="Make ALL users private? This cannot be undone easily.")
def bulk_private():
    """Make all users private (emergency lockdown)."""
    sql = "UPDATE users SET is_public = 0, updated_at = datetime('now')"
    execute_sql(sql)
    click.echo("✓ All users are now PRIVATE.")


@cli.command()
def schema():
    """Show the current table schema."""
    sql = "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    result = execute_sql(sql)
    
    results = result.get("result", [])
    if results and results[0].get("results"):
        rows = results[0]["results"]
        if rows:
            click.echo(rows[0].get("sql", "Schema not found"))
        else:
            click.echo("Users table not found. Run 'init' first.")
    else:
        click.echo("Users table not found. Run 'init' first.")


@cli.command()
def stats():
    """Show user statistics."""
    sql = """
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as public_count,
        SUM(CASE WHEN is_public = 0 THEN 1 ELSE 0 END) as private_count
    FROM users
    """
    result = execute_sql(sql)
    
    results = result.get("result", [])
    if results and results[0].get("results"):
        rows = results[0]["results"]
        if rows:
            stats = rows[0]
            click.echo(f"Total users:   {stats.get('total', 0)}")
            click.echo(f"Public users:  {stats.get('public_count', 0)}")
            click.echo(f"Private users: {stats.get('private_count', 0)}")
    else:
        click.echo("No statistics available. Run 'init' first.")


if __name__ == "__main__":
    cli()
