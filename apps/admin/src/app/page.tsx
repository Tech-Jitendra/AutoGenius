import { APP_NAME, APP_TAGLINE } from '@autogenius/constants';

export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>{APP_NAME} Admin</h1>
      <p>{APP_TAGLINE}</p>
      <p>Admin console foundation is up. Modules arrive in Task 02+.</p>
    </main>
  );
}
