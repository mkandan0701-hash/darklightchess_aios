import LoginForm from '@/components/LoginForm'

export const metadata = { title: 'Sign in · Darklight Chess Academy' }

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string }
}) {
  // Only accept a same-site path, so ?next= can't be used as an open redirect.
  const raw = searchParams?.next ?? '/'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'

  return <LoginForm next={next} />
}
