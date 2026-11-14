/** Read legacy preparation data without rewriting completed sessions. */
export function normalizeSessionPrep<T extends Record<string,any>>(source:T) {
  const modes:Record<string,string>={chat_only:'chat_first',chat_or_voice:'mixed',voice_preferred:'voice_or_chat'};
  return {...source,participation_mode:modes[source.participation_mode]||source.participation_mode||'mixed',
    anticipated_materials:Array.isArray(source.anticipated_materials)
      ?source.anticipated_materials.map((item:any)=>typeof item==='string'?item:item?.file_url||item?.title||'Material'):[]};
}
