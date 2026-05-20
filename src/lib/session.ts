// Pub/sub central com o uid do usuário aprovado.
// Stores escutam mudanças aqui para subscrever Firestore em users/{uid}/...
// e cancelar/limpar cache quando o usuário desloga ou troca.

type Listener = (uid: string | null) => void;

let currentUid: string | null = null;
const listeners = new Set<Listener>();

export function getCurrentUid(): string | null {
  return currentUid;
}

export function setCurrentUid(uid: string | null): void {
  if (uid === currentUid) return;
  currentUid = uid;
  listeners.forEach((l) => l(uid));
}

export function onUidChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
