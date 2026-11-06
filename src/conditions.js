// Reference only: user-provided Japanese second-edition rules, pp. 36–37.
export const conditions = [
 {id:'sneaking',nameJa:'スニーク',nameEn:'Sneaking',page:36,description:'スニークモデルを対象とする〈Shoot〉、または呪文による〈Cast〉には-2の修正が適用されます。ただし、射撃／呪文を行う敵モデルが、スニークモデルから6″を超えて離れている場合に限ります。さらに、スニークしている間に行う防御ロールでは、モデルは【Concealment】を用いることを選べます。'},
 {id:'berserk',nameJa:'バーサーク',nameEn:'Berserk',page:36,description:'この状態のモデルは〈Move〉〈Charge〉〈Attack〉の各アクションしか行えません。この状態の間、そのモデルが行う【Strike】ロールには+6の修正が適用されます。反対に、防御ロール（Defend）には-3の修正が適用されます。さらに、そのモデルは大胆不敵と堅忍のスキルを持つものとして扱います。'},
 {id:'stunned',nameJa:'朦朧',nameEn:'Stunned',page:37,description:'この状態のモデルが何らかのダイスロールを行う場合、そのロールに加えて【Fortitude】の能力値ダイスも振り、出目が低いほうを採用しなければなりません。もしそのロール自体が【Fortitude】ロールであるなら、【Fortitude】のダイスを2個振り、低いほうを採用します。'},
 {id:'paralysed',nameJa:'麻痺',nameEn:'Paralysed',page:37,description:'この状態のモデルは、いかなる理由でもアクションを宣言できず、ダイスを振ることもできません。本来なら防御ロールなどのロールが必要になる場合でも、その出目は0として扱います。'},
 {id:'burning',nameJa:'炎上',nameEn:'Burning',page:37,description:'この状態のモデルは、各ターン開始時にd6の負傷を受けます。この負傷はタフスキルや鎧によって軽減されません。出目が6の場合、そのターンは負傷を受けず、火は消えて状態も解除されます。また、炎上しているモデル自身、またはそのモデルにベースコンタクトしている他のモデルが、合計で〈Interact〉アクションを2回行えば、火を消してこの状態を取り除けます。'},
 {id:'blinded',nameJa:'盲目',nameEn:'Blinded',page:37,description:'行動自体は通常どおり行えます。ただし、どのような理由であれ能力値ダイスを振る場合（たとえば〈Attack〉で【Strike】を振る、〈Charge〉で【Move】を振る、など）、そのたびに【Awareness】も振り、出目が低いほうを採用しなければなりません。もしそのロール自体が【Awareness】ロールであるなら、【Awareness】のダイスを2個振り、低いほうを採用します。'},
];
export function setCondition(character,id,selected) {
 if(!conditions.some(c=>c.id===id)) throw Error('状態が不正です');
 const current=character.conditions||[];
 character.conditions=selected?[...new Set([...current,id])]:current.filter(v=>v!==id);
}

export const hasConditions = c => Boolean(c.conditions?.length || c.effects?.length);
