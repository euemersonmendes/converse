import { Laptop, Smartphone, Trash2, X, ShieldCheck } from 'lucide-react';
import type { DeviceSession } from '@converse/shared';

interface LinkedDevicesModalProps {
  devices: DeviceSession[];
  currentSessionId: string;
  onClose: () => void;
  onRevoke: (sessionId: string) => void;
}

export function LinkedDevicesModal({
  devices,
  currentSessionId,
  onClose,
  onRevoke,
}: LinkedDevicesModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0D1520] border border-[#1C2E42] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#132030] border-b border-[#1C2E42] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#00D4FF]" />
            <h3 className="font-semibold text-[#F0F7FF]">Dispositivos Conectados</h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#8BA4BE] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
          <p className="text-xs text-[#8BA4BE]">
            Gerencie todas as sessões ativas da sua conta no celular e no Converse Web.
          </p>

          {devices.map((d) => {
            const isMobile = d.platform.startsWith('mobile_');
            const isCurrent = d.id === currentSessionId;
            return (
              <div
                key={d.id}
                className="p-3.5 rounded-xl bg-[#132030] border border-[#1E3248] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#00D4FF]/15 text-[#00D4FF] flex items-center justify-center shrink-0">
                    {isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#F0F7FF] truncate">{d.deviceName}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00D4FF]/20 text-[#00D4FF] font-semibold">
                          Este aparelho
                        </span>
                      )}
                      {d.isPrimary && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-semibold">
                          Principal
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#8BA4BE]">
                      Última atividade: {new Date(d.lastActiveAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>

                {!d.isPrimary && (
                  <button
                    onClick={() => onRevoke(d.id)}
                    title="Desconectar sessão"
                    className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/15 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
