module.exports={
 presets:['module:@react-native/babel-preset'],
 plugins:[function({types:t}){return {visitor:{MemberExpression(path){
  if(t.isMetaProperty(path.node.object)&&path.node.object.meta.name==='import'&&path.node.property.name==='url')path.replaceWith(t.stringLiteral('https://divzplit.com/legal.js'));
 }}};}]
};
