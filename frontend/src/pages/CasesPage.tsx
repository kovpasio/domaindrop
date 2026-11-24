import { KeyRound } from 'lucide-react';
import { CasesPanel } from '@/components/CasesPanel';
import { PageTitle } from '@/components/PageTitle';
import { useAuth } from '@/context/AuthContext';

export function CasesPage() {
  const { me } = useAuth();

  return (
    <div>
      <PageTitle
        eyebrow="cases"
        title="Кейсы"
        description="Три случайные награды: домены и бустеры, редко — косметика."
        action={
          <div className="flex items-center gap-1 rounded-xl border border-gold/25 bg-gold/10 px-2.5 py-2 text-[10px] font-semibold text-gold">
            <KeyRound size={12} />
            {me?.user.case_keys ?? 0}
          </div>
        }
      />
      <CasesPanel />
    </div>
  );
}
