import type { User } from 'firebase/auth';

interface Props {
  user: User;
  mode?: 'pending' | 'rejected' | 'error';
  message?: string | null;
  onSignOut: () => void;
}

export default function PendingScreen({ user, mode = 'pending', message, onSignOut }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#F1F4E6] px-6 text-zinc-900">
      <div className="mb-6 text-center">
        <img
          src={`${import.meta.env.BASE_URL}icon-source.png`}
          alt=""
          aria-hidden
          className="mx-auto mb-2 h-20 w-20"
        />
        <h1 className="text-xl font-semibold">App de Alimentação</h1>
      </div>

      <div className="max-w-sm rounded-xl border border-zinc-200 bg-white px-4 py-4 text-center shadow-sm">
        {mode === 'rejected' && (
          <>
            <p className="mb-2 text-base font-medium text-red-700">Acesso negado</p>
            <p className="text-sm text-zinc-600">
              Sua solicitação de acesso foi rejeitada.
            </p>
          </>
        )}

        {mode === 'pending' && (
          <>
            <p className="mb-2 text-base font-medium">Aguardando aprovação</p>
            <p className="text-sm text-zinc-600">
              Você entrou como{' '}
              <strong className="break-all">{user.email}</strong>. O administrador
              precisa aprovar seu acesso. Tente novamente em alguns minutos.
            </p>
          </>
        )}

        {mode === 'error' && (
          <>
            <p className="mb-2 text-base font-medium text-red-700">Erro ao entrar</p>
            <p className="text-sm text-zinc-600">
              Você entrou como{' '}
              <strong className="break-all">{user.email}</strong>, mas algo deu
              errado:
            </p>
            {message && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-zinc-100 px-3 py-2 text-left text-xs text-zinc-700 whitespace-pre-wrap break-words">
                {message}
              </pre>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              Verifique se as Firestore rules foram publicadas e se o provedor
              Google está habilitado no Firebase Console.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
