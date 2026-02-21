import type { NextPageContext } from 'next';

type Props = { statusCode?: number };

export default function ErrorPage({ statusCode }: Props) {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        {statusCode ? `Error ${statusCode}` : 'An unexpected error occurred.'}
      </p>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};

