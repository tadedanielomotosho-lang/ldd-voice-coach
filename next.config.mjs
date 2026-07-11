/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['jspdf'],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  async headers() {
    return [
      {
        source: '/upload',
        headers: [{ key: 'Permissions-Policy', value: 'microphone=(self)' }],
      },
      {
        source: '/studio',
        headers: [{ key: 'Permissions-Policy', value: 'microphone=(self)' }],
      },
    ]
  },
}

export default nextConfig
