const path=require('path');
const {getDefaultConfig,mergeConfig}=require('@react-native/metro-config');
module.exports=mergeConfig(getDefaultConfig(__dirname),{
 watchFolders:[path.resolve(__dirname,'..')],
 resolver:{
  sourceExts:[...getDefaultConfig(__dirname).resolver.sourceExts,'mjs'],
  nodeModulesPaths:[path.resolve(__dirname,'node_modules')],
  resolveRequest(context,name,platform){return context.resolveRequest(context,name.split('?')[0],platform);}
 }
});
