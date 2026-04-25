/**
 * Devuelve el snippet JS oficial de Microsoft Clarity dado un projectId.
 * Llamado desde app/layout.tsx dentro de un <Script> de next/script.
 * Si projectId es undefined/empty, el caller NO debe renderizar el script.
 */
export function getClarityScript(projectId: string): string {
  return `
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${projectId}");
  `;
}
