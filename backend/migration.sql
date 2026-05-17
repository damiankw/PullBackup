-- Migration: Add audit_logs table and public_key_content column
-- Run this against your production database

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username VARCHAR(50),
    action VARCHAR(20) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    resource_name VARCHAR(255),
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Add public_key_content column to ssh_keys (will fail silently if already exists)
ALTER TABLE ssh_keys ADD COLUMN public_key_content TEXT;

-- Verify changes
SELECT 'Audit logs table:' as check;
SELECT COUNT(*) as audit_log_count FROM audit_logs;

SELECT 'SSH keys columns:' as check;
PRAGMA table_info(ssh_keys);

SELECT 'SSH keys count:' as check;
SELECT COUNT(*) as ssh_key_count FROM ssh_keys;
