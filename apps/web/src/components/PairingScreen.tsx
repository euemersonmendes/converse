import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, ShieldCheck, QrCode } from 'lucide-react';
import { SOCKET_EVENTS, type AuthSession, type PairingSession } from '@converse/shared';
import { api } from '../lib/api';
import { createPairingSocket } from '../lib/socket';

interface PairingScreenProps {
  onPaired: (session: AuthSession) => void;
}

export function PairingScreen({ onPaired }: PairingScreenProps) {
  const [pairing, setPairing] = useState<PairingSession | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [error, setError] = useState<string | null>(null);

  const loadNewPairing = async () => {
    try {
      setError(null);
      const browserName = navigator.userAgent.includes('Chrome')
        ? 'Converse Web (Chrome)'
        : navigator.userAgent.includes('Safari')
          ? 'Converse Web (Safari)'
          : 'Converse Web (Navegador)';
      const session = await api.createPairingSession(browserName);
      setPairing(session);
      setSecondsLeft(Math.max(1, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor.');
    }
  };

  useEffect(() => {
    loadNewPairing();
  }, []);

  useEffect(() => {
    if (!pairing) return;

    const socket = createPairingSocket();
    socket.on('connect', () => {
      socket.emit(SOCKET_EVENTS.PAIRING_JOIN, { pairingId: pairing.pairingId });
    });

    socket.on(SOCKET_EVENTS.PAIRING_APPROVED, (session: AuthSession) => {
      onPaired(session);
    });

    const poll = setInterval(async () => {
      try {
        const status = await api.getPairingStatus(pairing.pairingId);
        if (status.status === 'approved' && status.session) {
          onPaired(status.session);
        } else if (status.status === 'expired') {
          loadNewPairing();
        }
      } catch {
        // ignore transient poll error
      }
    }, 3000);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          loadNewPairing();
          return 90;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(poll);
      clearInterval(timer);
      socket.disconnect();
    };
  }, [pairing?.pairingId]);

  return (
    <div className="min-h-screen bg-[#070B12] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient Neon Glows */}
      <div className="absolute -top-32 left-1/4 w-[520px] h-[520px] rounded-full bg-[#00D4FF]/15 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 w-[480px] h-[480px] rounded-full bg-[#2563EB]/20 blur-[130px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6 px-2">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="Converse"
              className="h-16 w-auto object-contain"
            />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00D4FF] block">Web Companion</span>
              <p className="text-xs text-[#8BA4BE]">Mensagens em tempo real, Stories & Conexões</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-[#8BA4BE]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00D4FF]" /> Sincronização Segura
          </span>
        </div>

        {/* Main Card */}
        <div className="glass-panel rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.65)] overflow-hidden grid md:grid-cols-5">
          {/* Instructions */}
          <div className="md:col-span-3 p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#F0F7FF] mb-2">
                Conecte seu celular ao Converse Web
              </h2>
              <p className="text-sm text-[#8BA4BE] mb-6">
                Suas conversas, stories e conexões são sincronizados em tempo real com seu aparelho principal.
              </p>

              <ol className="space-y-4 text-sm text-[#D1D7DB]">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#00D4FF]/20 text-[#00D4FF] font-semibold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Abra o app <strong className="text-white">Converse</strong> no seu celular (iOS ou Android).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#00D4FF]/20 text-[#00D4FF] font-semibold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Toque em <strong className="text-white">Perfil &gt; Dispositivos Conectados &gt; Conectar um aparelho</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#00D4FF]/20 text-[#00D4FF] font-semibold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>
                    Aponte a câmera para o QR Code ao lado ou digite o código de 8 dígitos.
                  </span>
                </li>
              </ol>

              {pairing && (
                <div className="mt-6 p-3.5 rounded-xl bg-[#132030] border border-[#1E3248] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#8BA4BE] block">
                      Código de pareamento alternativo
                    </span>
                    <span className="font-mono text-lg font-bold tracking-widest text-[#00D4FF]">
                      {pairing.pairingCode}
                    </span>
                  </div>
                  <button
                    onClick={loadNewPairing}
                    className="p-2 rounded-lg hover:bg-[#1E3248] text-[#8BA4BE] hover:text-white transition"
                    title="Gerar novo código"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-8 pt-5 border-t border-[#1C2E42] flex items-center gap-2 text-xs text-[#8BA4BE]">
              <ShieldCheck className="w-4 h-4 text-[#00D4FF]" />
              <span>Sessão vinculada com revogação remota pelo aparelho principal</span>
            </div>
          </div>

          {/* QR Code Area */}
          <div className="md:col-span-2 bg-[#101B29] p-8 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-[#1C2E42]">
            {error && (
              <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 text-center">
                {error}
              </div>
            )}

            {pairing ? (
              <div className="flex flex-col items-center">
                <div className="p-4 bg-white rounded-2xl shadow-xl">
                  <QRCodeSVG value={pairing.qrPayload} size={200} level="M" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-[#8BA4BE]">
                  <QrCode className="w-3.5 h-3.5 text-[#00D4FF]" />
                  <span>Atualiza em {secondsLeft}s</span>
                </div>
              </div>
            ) : (
              <div className="w-[232px] h-[232px] rounded-2xl bg-[#132030] animate-pulse flex items-center justify-center text-xs text-[#8BA4BE]">
                Gerando QR Code...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
