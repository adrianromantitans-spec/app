// Reference: the current mobile website's computed styles (refined.css + dock-effects.css).
export const palette={background:'#F5F4F8',paper:'#FFFFFF',ink:'#272133',muted:'#82748F',purple:'#8552DB',purpleDark:'#6536A3',line:'#EAE6EF',green:'#157550',mint:'#C7F7DD',lavender:'#EEE6FB',input:'#FCF9FF',danger:'#A22F42'};
export const referenceIntro={assembly:1350,z:1550,hold:1539,flight:1161,opacityEnd:405,zStops:[387.5,589,1178,1395,1550],ink:'#2D203E',accent:'#8552DB',curtain:['#EEE6FA','#F8F4FC','#FAF8FD']};
export const fontFor=weight=>Number(weight||400)>=800?'ManropeExtraBold':Number(weight)>=700?'ManropeBold':Number(weight)>=600?'ManropeSemiBold':Number(weight)>=500?'ManropeMedium':'Manrope';
export const introSize=width=>width>760?52:Math.min(48,Math.max(37,width*.1));
// Measured from the current iPhone web surface (refined.css/dock-effects.js).
// Keep the explicitly requested circular native selector/add controls.
export const referenceSurface={credit:['#C7F3DC','#12553C'],debt:['#FFE1E6','#A2213C'],hero:['#6536A3','#8752D7'],heroBorder:'#FFFFFF24',currencySize:17,currencyWeight:'600',caption:'#F8F4FF',paid:'#187552',dock:{height:72,compactWidth:68,compactHeight:60,bottom:26,plusDown:6,idle:280,stiffness:420,damping:36,ink:'#6C5C7C',selector:'#E9DDFA99'}};
export function gradientBounds(width,height,degrees){
 const radians=degrees*Math.PI/180,dx=Math.sin(radians),dy=-Math.cos(radians),length=Math.abs(width*dx)+Math.abs(height*dy);
 return {x1:(width-dx*length)/2,y1:(height-dy*length)/2,x2:(width+dx*length)/2,y2:(height+dy*length)/2};
}
// The nested .stat-number rule has higher specificity than its 41 px wrapper.
export const homeAmountSize=width=>width<=360?34:width<=760?37:40;
