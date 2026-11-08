// User-provided Japanese second-edition translation, pp. 180, 182–184.
export const denUpgrades=[];
const add=(id,nameJa,nameEn,labour,materials,page,text,extra={})=>denUpgrades.push({id,nameJa,nameEn,labour,materials,page,text,...extra});
add('alchemy-laboratory','錬金術研究室','Alchemy Laboratory',12,4,180,'あなたは錬金術研究室を建設しました。任意にポーションや毒を蒸留できます。各戦闘の開始時に、以下の中から任意の3つを得ます：〈ヒーリングポーション〉、〈激痛毒〉（2回分）、〈麻痺毒〉（1回分）、〈致死毒〉（1回分）。');
add('apothecarium','施療院','Apothecarium',10,4,180,'あなたはバンドの負傷者を治療するための病院区画を建設しました。1ゲームにつき1回、重傷表（157ページ参照）のロールを1回リロールできる、または軽傷表のロールを1回無視できます。');
add('archery-range','射撃場','Archery Range',8,2,180,'あなたは射撃の訓練をするための区画を建設しました。経験成長（Experience Advance）のロールを行うとき（175ページ参照）、出目に関わらず、代わりにShooting系スキルを選んで取得してよいです。');
add('chapel','礼拝堂','Chapel',15,5,180,'あなたはアジトの中に、偉大なるアナグマにして、治癒と守護の古き神モリタスグス（Moritasgus）へ捧げる礼拝堂を建設しました。各戦闘の前に祝福を祈ってよい。d6をロールする。',{table:[['1〜2','モデル1体は次の戦闘の間、すべてのロールオフに+1を加えてよい。'],['3','思いがけない幸運が舞い込む。3d6ペニーを得る。'],['4','あなたのリーダーは神の憤怒に満たされ、次の戦闘の間、すべてのロールオフに+2を得る。'],['5〜6','偉業の運命に選ばれ、次の戦闘では自分の全モデルが追加の運命点を1点持って開始する。']]});
add('fletcher','矢羽細工場','Fletcher',6,3,180,'あなたは矢羽細工（fletching）を行うための区画を設けました。各戦闘の開始時に、自分のモデル2体まで、ボドキン（矢6本）またはブロードヘッド（矢6本）のいずれかを無料で装備してよいです。');
add('gambling-den','賭博場','Gambling Den',8,3,182,'あなたはアジトの一角に、悪徳と賭博のための区画を作りました。利益は大きいですが、リスクも伴います。d6を最大7個まで振ってよい。出た目の合計と同じ数のペニーを得る。\nただし、同じ目が3つ揃った場合（例：2が3つ）、喧嘩が起きてモデルが負傷する可能性がある。各モデルについてd4をロールし、1が出た場合、そのモデルは負傷して軽傷表（160ページ参照）でロールしなければならない。');
add('gymnasium','鍛錬場','Gymnasium',8,2,182,'あなたは重りや重量物を備えた訓練区画を建設しました。経験成長（Experience Advance）のロールを行うとき（175ページ参照）、出目に関わらず、代わりにStrength系スキルを選んで取得してよいです。');
add('jewellers-workshop','宝飾工房','Jewellers Workshop',8,2,182,'あなたは宝飾工房を建設しました。収入として4d6ペニーを得ます。');
add('library','図書館','Library',8,6,182,'あなたは優れた図書館を建設し、ノーサンブリアで集めた知識と、古代の広範な叡智と学識で満たしました。経験成長（Experience Advance）のロールはすべて、+1または-1の修正を加えてよい（175ページ参照）。');
add('magical-garden','魔法の庭','Magical Garden',12,3,182,'あなたは希少な薬草と、珍しい秘術装置を備えた、手入れの行き届いた魔法の庭を作りました。1ゲームにつき、任意の魔法素材（Ingredients）を3つまで無料で得てよい。\nまた、地元に薬草を売り、2d6ペニーを得る。');
add('obstacle-course','障害物コース','Obstacle Course',8,2,182,'あなたは獣たちが素早く機敏になるための訓練として、障害物コースを設置しました。経験成長（Experience Advance）のロールを行うとき、出目に関わらず、代わりにMovement系スキルを選んで取得してよい（142ページ参照）。');
add('occult-laboratory','秘教研究室','Occult Laboratory',16,5,183,'あなたは秘教的・神秘的な事柄を研究するための研究室を建設しました。d6をロールする：',{table:[['1〜4','あなたのリーダーは次の戦闘を、通常の3ではなく運命点5点で開始する。'],['5','あなたのバンド内の全モデルは次の戦闘を、通常の量ではなく運命点3点で開始する。'],['6','あなたのバンド内の魔法使い1体が新しい呪文を得る。所属（Allegiance）がアクセスできる魔法アーキタイプの中から1つ選ぶ。']]});
add('pells-and-training-ground','訓練杭と訓練場','Pells and Training Ground',8,2,183,'あなたは戦闘訓練のための区画を設け、戦士たちは定期的に訓練しています。経験成長（Experience Advance）のロールを行うとき（175ページ参照）、出目に関わらず、代わりにFighting系スキルを選んで取得してよいです。');
add('shrine','祠','Shrine',14,3,183,'あなたは祠を建てました。次のいずれかを選ぶ：',{choices:[{id:'woods-and-shadows',name:'森と影の主たちへの祠',text:'自分の全モデルは、すべての【Concealment】ロールに+1を得る。'},{id:'spirit-world',name:'霊界の精霊たちへの祠',text:'自分の魔法使いは全員、すべての〈Cast〉ロールオフに+1を得る。'}]});
add('smithy','鍛冶場','Smithy',12,4,184,'あなたは炉を備えた鍛冶場を建設し、自分で武器や防具を作れるようになりました。モデル1体以上を、〈労働〉〈放浪〉〈休養〉〈訓練〉の代わりに「鍛冶場の仕事」に割り当てた場合、割り当てた各モデルにつき12ペニー相当の武器または防具を作成してよい。たとえばモデル3体を割り当てれば、武器または防具を36ペニー相当ぶん作成できます。\nこの分は、コモンの武器・防具、または所属（Allegiance）のStarting Equipment Options Tableにあるレア武器・防具に使用できる。');
add('study','書斎','Study',8,3,184,'あなたは大学の文献のコレクションと、それを読み込むための書斎を備えました。経験成長（Experience Advance）のロールを行うとき（175ページ参照）、出目に関わらず、代わりにCunning系スキルを選んで取得してよいです。');
add('secret-tunnels','秘密のトンネル網','Secret Tunnels',14,3,184,'あなたは、周辺の各所に出入口を持つ、秘密のトンネルと巣穴のネットワークを備えました。戦闘に向けてバンドを配置するたび、モデル2体を、通常の配置制限を無視してテーブルトップ上の任意の場所に配置してよい。ただし、いかなる敵モデルからも8″以上離れていなければならない。');
add('smallholding','小作農場','Smallholding',10,3,184,'あなたのバンドは、食料用の虫を繁殖させる設備を整え、周囲の畑から定期的に作物も収穫しています。あなたのバンドは維持費（Upkeep）を支払う必要がありません。');
export const denUpgradeById=id=>denUpgrades.find(v=>v.id===id)||null;
export function selectDenUpgrade(status,id,selected){
 if(!denUpgradeById(id))throw Error('デンアップグレードが不正です');
 status.denUpgrades ||= [];
 if(selected){if(!status.denUpgrades.some(v=>v.id===id))status.denUpgrades.push({id,choice:null});}
 else status.denUpgrades=status.denUpgrades.filter(v=>v.id!==id);
}
export function chooseDenEffect(status,id,choice){
 const upgrade=denUpgradeById(id),selection=status.denUpgrades?.find(v=>v.id===id);
 if(!selection||!upgrade?.choices?.some(v=>v.id===choice))throw Error('アップグレードの効果が不正です');
 selection.choice=choice;
}
