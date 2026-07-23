import React from 'react';

interface VideoPlayerProps {
  /** ID numérico do vídeo no Vimeo. */
  vimeoId?: string;
  /** Título acessível do player (usado no atributo title do iframe). */
  title?: string;
  /** Badge curto exibido no canto superior do player. */
  badge?: string;
  /**
   * Padding-top do wrapper responsivo, no formato "100% 0 0 0" que o Vimeo
   * fornece no embed. Define a proporção do vídeo (100% = quadrado 1:1;
   * 177.78% = vertical 9:16; 56.25% = horizontal 16:9).
   */
  aspectPadding?: string;
}

// Player da VSL: embed responsivo do Vimeo dentro da moldura visual da home.
// Substitui o antigo player de <video> por MP4 — agora carrega o vídeo real
// hospedado no Vimeo ("Juntos por zuzu"), preservando badge, borda e sombra.
export default function VideoPlayer({
  vimeoId = '1212388149',
  title = 'Juntos por zuzu',
  badge = 'Missão em Angola',
  aspectPadding = '100%', // proporção real do vídeo no Vimeo (1:1 quadrado)
}: VideoPlayerProps) {
  const src =
    `https://player.vimeo.com/video/${vimeoId}` +
    `?badge=0&autopause=0&player_id=0&app_id=58479&title=0&byline=0&portrait=0`;

  return (
    <div className="w-full max-w-[520px] rounded-[28px] overflow-hidden bg-black shadow-2xl relative border-[6px] border-stone-900 mx-auto">
      {/* Wrapper responsivo do Vimeo: padding-top define a proporção do vídeo */}
      <div style={{ padding: `${aspectPadding} 0 0 0`, position: 'relative' }}>
        <iframe
          src={src}
          title={title}
          loading="lazy"
          frameBorder={0}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* Badge superior sobre o vídeo */}
      {badge && (
        <div className="absolute top-4 left-4 bg-terracotta-600/80 backdrop-blur-md text-white text-xs font-black tracking-widest uppercase px-3 py-1.5 rounded-full z-10 shadow-md pointer-events-none">
          {badge}
        </div>
      )}
    </div>
  );
}
