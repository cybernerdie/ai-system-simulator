import { Trophy } from 'lucide-react';

export function AchievementToast({ title }: { title: string }) {
  return (
    <div className="ach-toast" role="status">
      <Trophy size={16} aria-hidden />
      <div>
        <span>Achievement</span>
        <strong>{title}</strong>
      </div>
    </div>
  );
}
