import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(
        cookiesToSet: {
          name: string
          value: string
          options?: Parameters<NextResponse["cookies"]["set"]>[2]
        }[],
      ) {
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (path.startsWith("/dashboard")) {
    if (!user) {
      const login = new URL("/auth/login", request.url)
      login.searchParams.set("next", path)
      return NextResponse.redirect(login)
    }
  }

  const authLandingPaths = ["/auth/login", "/auth/register", "/auth/forgot-password"]
  if (authLandingPaths.some((p) => path === p || path.startsWith(`${p}/`))) {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  if (path === "/" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
