interface AvatarProps {
  nome?: string | null;
  cor?: string | null;
  avatar_url?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

const tamanhos = {
  xs: 'w-5 h-5 text-[8px]',
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-14 h-14 text-lg',
};

export default function Avatar({ nome, cor, avatar_url, size = 'sm', className = '', title }: AvatarProps) {
  const iniciais = (nome || '?')
    .split(' ')
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('');

  const corFundo = cor || '#dc2626';

  return (
    <div
      title={title || nome || ''}
      className={`${tamanhos[size]} rounded-none flex items-center justify-center font-black uppercase shrink-0 border border-black/30 ${className}`}
      style={{ backgroundColor: corFundo }}
    >
      {avatar_url ? (
        <img src={avatar_url} alt={nome || ''} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white leading-none">{iniciais}</span>
      )}
    </div>
  );
}
