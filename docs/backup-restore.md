# Backup & Restore Procedures

## Overview

This document covers backup and restore procedures for the Ghana SHS Management System. The system stores data in two locations:

1. **PostgreSQL Database** — All application data (students, finance, academics, etc.)
2. **Cloudflare R2** — Uploaded files (documents, admission attachments, medical records)

---

## PostgreSQL Database Backup

### Automated Daily Backup (Recommended)

Set up a cron job on the database server:

```bash
# /etc/cron.d/sms-backup
# Daily at 2:00 AM, retain 30 days
0 2 * * * postgres pg_dump -Fc --no-owner sms_db > /backups/sms_db_$(date +\%Y\%m\%d).dump 2>> /var/log/sms-backup.log
0 3 * * * find /backups -name "sms_db_*.dump" -mtime +30 -delete
```

### Manual Backup

```bash
# Full compressed backup
pg_dump -h localhost -U sms_user -Fc --no-owner sms_db > sms_db_backup_$(date +%Y%m%d_%H%M%S).dump

# SQL format (human-readable, larger)
pg_dump -h localhost -U sms_user --no-owner sms_db > sms_db_backup.sql

# Schema only (no data)
pg_dump -h localhost -U sms_user --schema-only sms_db > sms_schema.sql

# Specific tables only
pg_dump -h localhost -U sms_user -t "Student" -t "Payment" sms_db > sms_critical_tables.sql
```

### Restore from Backup

```bash
# Restore from compressed dump (recommended)
pg_restore -h localhost -U sms_user -d sms_db --clean --no-owner sms_db_backup.dump

# Restore from SQL file
psql -h localhost -U sms_user -d sms_db < sms_db_backup.sql

# Restore to a new database (safe — doesn't overwrite production)
createdb -h localhost -U sms_user sms_db_restored
pg_restore -h localhost -U sms_user -d sms_db_restored sms_db_backup.dump
```

### Pre-Migration Backup

**Always** take a backup before running Prisma migrations:

```bash
pg_dump -Fc --no-owner sms_db > pre_migration_$(date +%Y%m%d_%H%M%S).dump
npx prisma migrate deploy
```

---

## Cloudflare R2 File Backup

### Using rclone (Recommended)

Install rclone and configure an R2 remote:

```bash
# Configure rclone for R2
rclone config
# Name: r2
# Type: s3
# Provider: Cloudflare
# Access Key: <R2_ACCESS_KEY_ID>
# Secret Key: <R2_SECRET_ACCESS_KEY>
# Endpoint: <R2_ENDPOINT>

# Sync R2 bucket to local backup directory
rclone sync r2:sms-uploads /backups/r2-files/

# Sync to another cloud storage for redundancy
rclone sync r2:sms-uploads gcs:sms-backup-bucket/r2-files/
```

### Manual R2 Backup

```bash
# Using AWS CLI (R2 is S3-compatible)
aws s3 sync s3://sms-uploads ./r2-backup/ \
  --endpoint-url $R2_ENDPOINT
```

---

## Docker Volume Backup

If running PostgreSQL in Docker:

```bash
# Backup the Docker volume
docker run --rm \
  -v sms-system_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_volume_$(date +%Y%m%d).tar.gz /data
```

---

## Disaster Recovery Checklist

### Full System Restore

1. **Provision infrastructure** (server, PostgreSQL, Redis)
2. **Restore database**: `pg_restore -d sms_db backup.dump`
3. **Restore files**: `rclone sync backup-location r2:sms-uploads`
4. **Run migrations**: `npx prisma migrate deploy`
5. **Seed if needed**: `npm run db:seed` (only for fresh databases)
6. **Deploy application**: `docker compose up -d`
7. **Verify health**: Check `/api/auth/session` responds
8. **Verify data**: Log in as admin, check student count, recent payments

### Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Application crash | 5 min (container restart) | 0 (no data loss) |
| Database corruption | 30 min (restore from backup) | Up to 24 hours |
| Full server loss | 2 hours (re-provision + restore) | Up to 24 hours |
| R2 bucket loss | 1 hour (restore from rclone backup) | Up to 24 hours |

---

## Monitoring Backup Health

### Verify Backup Integrity

```bash
# Test restore to a temporary database
createdb sms_db_test
pg_restore -d sms_db_test latest_backup.dump
psql -d sms_db_test -c "SELECT COUNT(*) FROM \"Student\";"
psql -d sms_db_test -c "SELECT COUNT(*) FROM \"Payment\";"
dropdb sms_db_test
```

### Alert on Failed Backups

Add to your monitoring system:

```bash
# Check backup file exists and is recent (< 25 hours old)
LATEST=$(find /backups -name "sms_db_*.dump" -mtime -1 | head -1)
if [ -z "$LATEST" ]; then
  echo "ALERT: No database backup found in the last 24 hours!"
  # Send alert via your monitoring system
fi
```

---

## Data Retention

The system includes automated retention policies (see `src/lib/retention/policy.ts`):

- **SMS logs**: 90 days for delivered/failed
- **Read notifications**: 60 days
- **Rejected applications**: Anonymized after 1 year
- **Audit logs**: Archived after 5 years
- **Student records, financial data**: Retained indefinitely

Run the retention worker periodically:

```bash
# Via BullMQ scheduled job or cron
npx tsx src/workers/retention.worker.ts
```
