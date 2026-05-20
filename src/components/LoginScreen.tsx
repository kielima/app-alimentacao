interface Props {
  onSignIn: () => void;
  signingIn: boolean;
  error: string | null;
  unconfigured?: boolean;
}

export default function LoginScreen({ onSignIn, signingIn, error, unconfigured }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#F1F4E6] px-6 text-zinc-900">
      <div className="mb-8 text-center">
        <img
          src={`${import.meta.env.BASE_URL}icon-source.png`}
          alt=""
          aria-hidden
          className="mx-auto mb-2 h-20 w-20"
        />
        <h1 className="text-xl font-semibold">App de Alimentação</h1>
      </div>

      {unconfigured ? (
        <div className="max-w-sm rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Firebase não configurado. Preencha as variáveis VITE_FIREBASE_* em
          .env.local para habilitar o login.
        </div>
      ) : (
        <>
          <p className="mb-6 max-w-xs text-center text-sm text-zinc-600">
            Entre com sua conta Google para acessar o app.
          </p>

          <button
            type="button"
            onClick={onSignIn}
            disabled={signingIn}
            className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-medium text-zinc-800 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            <GoogleIcon />
            {signingIn ? 'Entrando…' : 'Entrar com Google'}
          </button>

          {error && (
            <div className="mt-4 max-w-sm rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.34l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
