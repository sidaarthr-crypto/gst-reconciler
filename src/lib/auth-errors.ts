/** Map Supabase auth errors to friendly copy for login / register forms */
export function mapAuthErrorMessage(message: string): string {
  const m = message.toLowerCase()
  if (
    m.includes("invalid login credentials") ||
    m.includes("invalid credentials") ||
    m.includes("invalid email or password")
  ) {
    return "Incorrect email or password. Please try again."
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for the confirmation link."
  }
  return message
}
