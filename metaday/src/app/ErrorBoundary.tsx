import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Último recurso contra uma falha de renderização. Como o METADAY BETA 0.1 guarda tudo
 * localmente (IndexedDB), uma tela quebrada não é o mesmo que perder dados — a mensagem
 * deixa isso claro e oferece recarregar, sem culpar o usuário.
 *
 * Só um componente de classe pode capturar erros de renderização em React; não há
 * equivalente em hooks.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Único canal de diagnóstico disponível no BETA 0.1 (sem telemetria/relato remoto).
    console.error('METADAY: erro não tratado na interface', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="size-12 text-risk" aria-hidden />
        <h1 className="text-xl font-bold text-foreground">Algo deu errado nesta tela</h1>
        <p className="text-sm text-muted">
          Seus objetivos, hábitos e check-ins continuam salvos neste dispositivo — este erro é só da tela, não dos
          seus dados. Tente recarregar o aplicativo.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-foreground"
        >
          Recarregar
        </button>
        <details className="mt-2 w-full text-left text-xs text-dim">
          <summary className="cursor-pointer">Detalhes técnicos</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-2">
            {this.state.error.message}
          </pre>
        </details>
      </div>
    );
  }
}
