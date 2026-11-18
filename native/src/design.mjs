// Reference: the current mobile website's computed styles (refined.css + dock-effects.css).
export const palette={background:'#F5F4F8',paper:'#FFFFFF',ink:'#272133',muted:'#82748F',purple:'#8552DB',purpleDark:'#6536A3',line:'#EAE6EF',green:'#157550',mint:'#C7F7DD',lavender:'#EEE6FB',input:'#FCF9FF',danger:'#A22F42'};
export const referenceIntro={assembly:1350,z:1550,hold:1539,flight:1161,opacityEnd:405,zStops:[387.5,589,1178,1395,1550],ink:'#272133',accent:'#8552DB',curtain:['#EEE6FA','#F8F4FC','#FAF8FD']};
export const fontFor=weight=>Number(weight||400)>=800?'ManropeExtraBold':Number(weight)>=700?'ManropeBold':Number(weight)>=600?'ManropeSemiBold':Number(weight)>=500?'ManropeMedium':'Manrope';
export const introSize=width=>Math.min(64,Math.max(38,width*.1));
