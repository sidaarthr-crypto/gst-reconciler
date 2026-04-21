# Supabase Email Setup for GSTRecon

## Enable in Supabase Dashboard

1. Authentication → Settings → Email Auth → Enable
2. Authentication → Email Templates → customize:

### Confirmation Email Template

Subject: "Confirm your GSTRecon account"

Body: Clean HTML with:

- GSTRecon logo/name
- "Hi [Name], confirm your email to start reconciling"
- Large CTA button: "Confirm Email →"
- "This link expires in 24 hours"

### Password Reset Template

Subject: "Reset your GSTRecon password"

Body:

- "You requested a password reset"
- CTA button: "Reset Password →"
- "This link expires in 1 hour"
- "If you didn't request this, ignore this email"

## For Production

Use a custom SMTP provider (Resend recommended):

Authentication → Settings → SMTP Settings

Sign up at [https://resend.com](https://resend.com), get API key

- SMTP Host: `smtp.resend.com`
- Port: `465`
- User: `resend`
- Password: your Resend API key
- Sender: `noreply@yourdomain.com`
