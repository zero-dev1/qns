import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Twitter,
  Github,
  Globe,
  Send,
  Loader2,
  Share2,
  Gift,
  Copy,
} from 'lucide-react';
import { namehash, getPublicClient, getRegistration, validateNameLocal, getWalletClient, getQFBalance, formatQF } from '../utils/qns';
import {
  QNS_RESOLVER_ADDRESS,
  QNS_RESOLVER_ABI,
} from '../config/contracts';
import { useWalletStore } from '../stores/walletStore';
import { parseEther } from 'viem';
import { useCopy } from '../hooks/useCopy';
import { hapticSuccess, hapticError, hapticTap } from '../utils/haptics';
import { TEAM_NAMES, DAPP_LAB_NAMES } from '../utils/badges';

// Static reserved names list from adminStore
const RESERVED_NAMES_LIST = [
  'btc','eth','usdt','bnb','sol','usdc','xrp','doge','ton','ada','avax','trx','link','near','matic','pepe','dai','uni','cro','atom','okb','xlm','algo','fil','apt','ldo','rune','icp','etc','arb','grt','op','tao','bonk','fet','nexo','zk','jup','theta','ondo','ftm','bome','ar','sand','chz','axs','gala','flock','sei','sui','bch','ltc','dot','kas','vet','mnt','strk','imx','egld','snx','zec','gmt','flow','floki','band','celo','hot','gno','iota','wld','kcs','dash','mkr','dydx','ray','beam','qtum','kava','ont','zen','kda','usdd','ftn','tusd','gas','pepecoin','bsv','lunc','xdg','safemoon','wbtc','twt','shib','eos','xtz','btt','shiba','paxg','neo','leo','xmr','mina','kuji','xaut','cake','kaspa','rndr','enj','crv','mana','aave','bat','comp','one','yfi','cvx','woo','celr','ankr','ocean','iotx','cocos','cfx','sc','lsk','rvn','dgb','hive','steem','xem','bcd','srm','dcr','kmd','nav','xvg','burst','qkc','wan','dodo','elf','ardr','strax','ark','mtl','req','storj','ogn','poly','fun','cvc','nkn','blz','data','gnosis','amp','audio','spell','trb','uft','snow','rook','pha','akro','strm','front','mir','perp','tko','rad','mta','dia','jst','wnxm','wexpoly','mdx','sun','bifi','marsh','auto','nuls','tomoe','wiotx','wing','for','lina','rlc','hnt','alpha','coti','ctsi','chess','sfp','alpine','bsw','c98','quick','ach','dusk','tfuel','solana','polkadot','avalanche','chainlink','polygon','uniswap','cosmos','algorand','stellar','filecoin','internetcomputer','tezos','eosio','nearprotocol','flow','elrond','maker','compound','curve','synthetix','balancer','yearn','sushiswap','1inch','loopring','bancor','kyber','0x','gitcoin','chain','basicattentiontoken','decred','digibyte','ravencoin','bitcoincash','litecoin','ethereumclassic','dash','zcash','monero','bitcoin','ethereum','binance','coinbase','kraken','gemini','bitfinex','huobi','okx','bybit','kucoin','gateio','bitstamp','bithumb','coincheck','bitflyer','blockchain','crypto','cryptocurrency','defi','nft','web3','metaverse','dao','dex','cex','wallet','paper','billfold','purse','safeguard','vault','secure','safu','trust','coldstorage','custody','deposit','withdraw','transfer','multisig','signature','guardian','protect','shield','lock','encrypt','mnemonic','seedphrase','privatekey','publickey','address','smartcontract','dapp','web3app','decentralized','protocol','mainnet','testnet','sidechain','layer1','layer2','rollup','validity','optimistic','zero-knowledge','zk','consensus','validator','stake','staking','yield','farming','liquidity','pool','amm','swap','trading','arbitrage','flashloan','flashbots','oracle','datafeed','pricefeed','randomness','verifiable','verifier','prover','circuit','constraint','circom','snark','stark','bulletproofs','ipfs','filestorage','storage','database','query','subgraph','thegraph','indexing','explorer','scanner','api','rpc','rest','graphql','websocket','sdk','cli','devtools','debugger','compiler','bytecode','abi','interface','contract','deploy','verify','audited','audit','security','exploit','bug','hack','insurance','coverage','risk','underwriter','governance','vote','voting','dao','proposal','treasury','grant','bounty','reward','incentive','airdrop','faucet','test','dev','development','sandbox','staging','production','live','main','beta','alpha','experimental','deprecated','archived','snapshot','checkpoint','finality','fork','reorg','reorganization','genesis','block','blockheight','timestamp','nonce','gas','fee','priority','basefee','tip','maxfee','gaslimit','gasused','calldata','memory','storage','stack','opcode','evm','wasm','riscv','account','eoa','externallyowned','contractaccount','factory','proxy','beacon','upgradable','immutable','transparent','uups','diamond','facet','erc20','erc721','erc1155','erc4626','erc4337','accountabstraction','paymaster','bundler','entrypoint','walletconnect','walletlink','coinbasepay','moonpay','transak','ramp','stripe','payment','checkout','commerce','subscription','recurring','billing','invoice','escrow','vesting','tge','tokengeneration','launch','ido','ieo','ico','presale','whitelist','allocation','distribution','emission','supply','circulating','maxsupply','totalsupply','burn','mint','rebase','elastic','algorithmic','stable','fiatbacked','cryptobacked','synthetix','synth','mirror','equity','stock','commodity','gold','silver','oil','forex','derivative','option','future','perpetual','perp','margin','leverage','collateral','debt','credit','loan','borrow','lend','interest','apy','apr','rate','index','cpi','inflation','deflation','recession','gdp','economy','macro','micro','fiat','currency','centralbank','federalreserve','ecb','boj','pboc','imf','worldbank','sec','cftc','finma','fca','asic','mas','bafin','regulation','compliance','aml','kyc','identity','privacy','anonymous','pseudonymous','mixer','tornado','zcash','monero','dash','privacypool','stealth','address','utxo','accountmodel','state','trie','merkle','patricia','rlp','abiencoding','solidity','vyper','yul','asm','rust','move','cairo','huff','fe','amber','dapp','app','frontend','backend','fullstack','webdev','dev','coder','hacker','builder','founder','entrepreneur','investor','trader','holder','whale','shark','dolphin','fish','shrimp','pleb','noob','degen','ape','fomo','fud','hodl','wagmi','ngmi','gm','gn','ser','mam',' fren','based','cringe','kek','lol','lmao','wtf','omg','idk','tbh','imo','imho','fyi','psa','alpha','beta','delta','gamma','theta','vega','rho','sigma','omega','lambda','zeta','xi','chi','psi','vitalik','satoshi','nakamoto','buterin','wood','gavin','joe','lubin','charles','hoskinson','anatoly','hayden','andre','cronje','kain','warwick','rune','stani','robert','maker','compound','balancer','banteg','devcon','ethglobal','hackathon','summit','conference','meetup','community','discord','telegram','twitter','x','reddit','forum','blog','mirror','medium','substack','podcast','youtube','tiktok','twitch','streamer','gamer','esports','nft','digitalart','generative','pfp','avatar','collectible','gaming','metaverse','virtual','augmented','mixedreality','xr','spatial','3d','voxel','pixel','sprite','texture','shader','material','model','animation','rigging','motion','physics','particle','effect','lighting','render','raytracing','rasterization','gpu','cpu','hardware','software','firmware','driver','kernel','os','linux','unix','macos','windows','ios','android','mobile','desktop','laptop','server','cloud','edge','cdn','network','lan','wan','man','pan','wifi','bluetooth','nfc','rfid','iot','sensor','actuator','robotics','automation','ai','ml','deeplearning','neuralnetwork','llm','gpt','bert','transformer','diffusion','gan','vae','rl','reinforcement','supervised','unsupervised','clustering','classification','regression','prediction','forecast','timeseries','anomaly','fraud','scam','phishing','honeypot','rugpull','exploit','rekt','fud','hopium','copium','doomer','bloomer','bull','bear','crab','kangaroo','whale','shark','dolphin','fish','shrimp','pleb','noob','degen','moon','lambo','yacht','privatejet','island','mansion','castle','fortress','citadel','bunker','vault','safe','lockbox','treasure','gold','diamond','platinum','silver','bronze','copper','iron','steel','titanium','carbon','fiber','nano','quantum','fusion','fission','atomic','nuclear','chemical','biological','genetic','synthetic','organic','vegan','carnivore','keto','paleo','mediterranean','sushi','pizza','burger','taco','burrito','ramen','curry','bbq','steak','salad','smoothie','coffee','tea','water','milk','beer','wine','cocktail','whiskey','vodka','rum','gin','tequila','mezcal','sake','soju','baijiu','huangjiu','arrack','raki','ouzo','pastis','vermouth','aperol','campari','bitter','amaro','fernet','jaeger','kahlua','baileys','kahlua','tia','maria','malibu','coconut','pineapple','mango','passionfruit','dragonfruit','kiwi','papaya','guava','lychee','rambutan','durian','mangosteen','jackfruit','breadfruit','tamarind','date','fig','raisin','currant','prune','apricot','peach','plum','cherry','berry','strawberry','blueberry','raspberry','blackberry','cranberry','gooseberry','elderberry','mulberry','boysenberry','loganberry','cloudberry','lingonberry','huckleberry','bilberry','acai','acerola','amla','barberry','buffaloberry','chokeberry','chokecherry','cloudberry','crowberry','dewberry','dogwood','elderberry','goji','goldenberry','hawthorn','juniper','lingonberry','marionberry','medlar','mulberry','nannyberry','pigeonplum','pokeweed','saskatoon','sea','buckthorn','serviceberry','sloe','snowberry','wolfberry','yew','almond','cashew','chestnut','hazelnut','macadamia','pecan','pine','pistachio','walnut','peanut','coconut','sunflower','pumpkin','sesame','chia','flax','hemp','poppy','caraway','cumin','dill','fennel','coriander','cardamom','cinnamon','clove','ginger','nutmeg','allspice','anise','star','vanilla','saffron','turmeric','paprika','cayenne','chili','pepper','salt','sugar','honey','maple','molasses','syrup','caramel','butterscotch','toffee','fudge','chocolate','cocoa','coffee','espresso','latte','cappuccino','mocha','americano','macchiato','flatwhite','affogato','ristretto','lungo','cortado','breve','red','eye','black','eye','drip','pour','over','french','press','aeropress','chemex','siphon','cold','brew','nitro','kombucha','matcha','oolong','puerh','sencha','gyokuro','dragonwell','tieguanyin','dahongpao','keemun','assam','darjeeling','ceylon','earlgrey','english','breakfast','irish','breakfast','scottish','breakfast','russian','caravan','lapsang','souchong','yunnan','golden','needle','silver','yunnan','jasmine','chrysanthemum','osmanthus','magnolia','rose','lavender','chamomile','peppermint','spearmint','lemongrass','ginger','turmeric','rooibos','honeybush','yerba','mate','guayusa','yaupon','hollies','aquifoliaceae','ixaceae','rubiac','theaceae','asteraceae','lamiaceae','zingiberaceae','poaceae','fabaceae','asteraceae','apiaceae','brassicaceae','chenopodiaceae','cucurbitaceae','lamiaceae','lauraceae','myrtaceae','pandanaceae','piperaceae','poaceae','rutaceae','santalaceae','solanaceae','zingeberaceae','musaceae','musaceae','araceae','bromeliaceae','caricaceae','cumarinaceae','datiscaceae','dioscoreaceae','musaceae','pandar','anar','card','punc','gran','at','um','myrt','ifoli','agraceae','aster','id','ae','eric','ae','th','eophy','ll','aceae','aqu','ifoli','ce','ae','rhamnaceae','rosaceae','rutaceae','sapindaceae','sapotaceae','simaroubaceae','solanaceae','staphyleaceae','styracaceae','symplocaceae','tec','ae','st','ulin','ae','ulm','aceae','ur','tic','ap','ocyn','aceae','aqu','ifoli','aceae','ar','aceae','ar','alia','ceae','aster','aceae','berberidaceae','betul','aceae','bignoniaceae','bix','aceae','bom','ac','aceae','boraginaceae','brassi','aceae','burser','aceae','cact','aceae','camp','anul','aceae','cann','ab','aceae','cappar','aceae','caprifoliaceae','caryocaraceae','casuarinaceae','celastraceae','cephalotaxaceae','chenopodiaceae','chrysobalanaceae','cistaceae','clethraceae','combretaceae','commelinaceae','convolvulaceae','cornaceae','corynocarpaceae','crossosomataceae','cucurbitaceae','cunoniaceae','cuscutaceae','cyrillaceae','datiscaceae','diapensiaceae','didiereaceae','dilleniaceae','diospyraceae','dipterocarpaceae','doryanthaceae','droseraceae','ecdeiocoleaceae','elaeagnaceae','elaeocarpaceae','empetraceae','ephedraceae','ericaceae','erythroxylaceae','escalloniaceae','eucommiaceae','euphorbiaceae','eupomatiaceae','fagaceae','flagellariaceae','foetidiaceae','frankeniaceae','garryaceae','geissolomataceae','geraniaceae','ginkgoaceae','goodeniaceae','griseliniaceae','gunneraceae','gyrostemonaceae','halophytaceae','hamamelidaceae','hanguanaceae','heliconiaceae','hemp','high','higher','highest','low','lower','lowest','up','down','left','right','forward','backward','fast','slow','quick','instant','immediate','rapid','swift','speedy','hasty','gradual','slowly','steadily','consistently','regularly','periodically','frequently','often','sometimes','rarely','seldom','never','always','usually','normally','generally','commonly','typically','mostly','partly','fully','completely','totally','entirely','wholly','absolutely','relatively','fairly','quite','rather','pretty','very','extremely','highly','deeply','greatly','strongly','weakly','slightly','barely','hardly','scarcely','nearly','almost','approximately','roughly','about','around','close','near','far','distant','remote','local','global','universal','worldwide','international','national','regional','state','city','town','village','rural','urban','suburban','metropolitan','capital','central','downtown','midtown','uptown','east','west','north','south','northeast','northwest','southeast','southwest','eastward','westward','northward','southward','upward','downward','inward','outward','forward','backward','ahead','behind','beyond','across','through','into','onto','upon','over','under','above','below','beneath','underneath','within','without','inside','outside','interior','exterior','internal','external','inner','outer','upper','lower','top','bottom','side','edge','center','middle','between','among','amid','amidst','beside','along','alongside','against','toward','towards','from','until','till','since','before','after','during','while','when','whenever','where','wherever','why','how','what','which','who','whom','whose','whatever','whoever','whichever','however','moreover','furthermore','therefore','thus','hence','consequently','accordingly','otherwise','instead','nevertheless','nonetheless','however','yet','still','already','just','only','even','also','too','either','neither','both','all','each','every','any','some','many','much','more','most','few','fewer','fewest','little','less','least','several','various','certain','particular','specific','general','universal','common','public','private','personal','individual','collective','joint','shared','mutual','reciprocal','own','mine','yours','his','hers','its','ours','theirs','one','oneself','myself','yourself','himself','herself','itself','ourselves','yourselves','themselves','this','that','these','those','such','same','other','another','different','similar','like','alike','unlike','equal','equivalent','comparable','relative','relevant','related','connected','associated','linked','joined','combined','united','together','separate','apart','alone','single','sole','only','unique','distinct','special','especial','particular','peculiar','specific','certain','sure','certainly','surely','indeed','actually','really','truly','genuinely','authentically','literally','exactly','precisely','accurately','correctly','right','wrong','false','true','truth','lie','error','mistake','fault','blame','shame','honor','pride','glory','fame','name','reputation','character','nature','quality','property','feature','characteristic','attribute','trait','aspect','element','component','constituent','ingredient','part','portion','piece','section','segment','division','department','branch','sector','field','area','region','zone','territory','domain','realm','kingdom','empire','republic','nation','country','land','state','province','county','district','zone','area','region','place','spot','point','location','position','site','station','post','base','camp','home','house','building','structure','construction','architecture','design','plan','scheme','system','method','way','manner','mode','fashion','style','form','shape','figure','pattern','model','mold','cast','stamp','brand','mark','sign','symbol','token','badge','emblem','logo','trademark','label','tag','ticket','card','slip','note','memo','message','letter','mail','post','parcel','package','box','case','container','vessel','holder','repository','reservoir','tank','pool','pond','lake','sea','ocean','river','stream','brook','creek','spring','fountain','well','source','origin','root','cause','reason','motive','purpose','aim','goal','object','end','target','mark','objective','intent','intention','plan','design','project','scheme','program','schedule','agenda','calendar','diary','journal','log','record','account','history','story','tale','narrative','report','statement','declaration','announcement','proclamation','pronouncement','utterance','expression','word','term','phrase','clause','sentence','paragraph','chapter','section','division','part','volume','book','opus','work','composition','production','creation','making','manufacture','construction','building','erection','establishment','foundation','institution','organization','association','society','company','corporation','firm','business','enterprise','venture','undertaking','endeavor','attempt','effort','try','shot','stab','go','turn','time','chance','opportunity','opening','break','occasion','event','incident','episode','instance','example','case','illustration','demonstration','proof','evidence','testimony','witness','sign','indication','token','mark','symptom','clue','hint','suggestion','tip','advice','counsel','guidance','direction','instruction','order','command','commandment','directive','charge','injunction','mandate','decree','edict','fiat','dictate','ruling','judgment','decision','verdict','finding','conclusion','determination','resolution','settlement','agreement','contract','compact','covenant','treaty','accord','concordat','concord','pact','alliance','league','union','confederation','federation','coalition','bloc','combination','conjunction','connection','association','affiliation','attachment','bond','tie','link','relation','relationship','rapport','liaison','romance','love','passion','desire','lust','attraction','appeal','charm','fascination','enchantment','magic','witchcraft','sorcery','wizardry','necromancy','divination','prophecy','prediction','foresight','foresight','vision','dream','nightmare','fantasy','imagination','fancy','notion','idea','concept','conception','thought','thinking','cognition','knowledge','knowing','understanding','comprehension','apprehension','perception','sense','sensation','feeling','emotion','sentiment','affection','fondness','liking','preference','taste','appetite','hunger','thirst','craving','desire','wish','want','need','necessity','requirement','demand','request','petition','appeal','application','proposal','proposition','suggestion','recommendation','advice','counsel','opinion','view','belief','faith','trust','confidence','reliance','dependence','hope','expectation','anticipation','prospect','outlook','future','past','present','now','today','tomorrow','yesterday','soon','later','early','late','old','new','young','aged','ancient','modern','contemporary','current','recent','fresh','novel','original','creative','inventive','imaginative','fanciful','whimsical','fantastic','odd','strange','weird','bizarre','peculiar','curious','queer','quaint','quaint','queer','odd','peculiar','strange','weird','bizarre','fantastic','fanciful','whimsical','curious','funny','laughable','amusing','entertaining','diverting','recreational','leisure','relaxation','rest','repose','ease','comfort','luxury','wealth','richness','affluence','opulence','abundance','plenty','profusion','multitude','mass','heap','pile','stack','load','batch','lot','bunch','group','cluster','clump','clump','chunk','hunk','lump','block','brick','cake','bar','rod','stick','strip','band','ribbon','tape','cord','rope','line','string','thread','wire','cable','chain','link','connection','relation','relationship','association','bond','tie','knot','loop','circle','ring','hoop','wheel','disk','plate','sheet','film','layer','coat','cover','covering','blanket','quilt','comforter','bedding','linens','sheets','pillows','cushions','mattress','bed','couch','sofa','settee','bench','seat','chair','stool','ottoman','footstool','recliner','rocker','swivel','folding','lounge','chaise','daybed','futon','hammock','cradle','crib','bassinet','bunk','loft','canopy','four-poster','sleigh','platform','adjustable','massage','beanbag','pouf','cube','storage','window','seat','inglenook','alcove','recess','niche','nook','corner','angle','turn','bend','curve','arc','arch','vault','dome','roof','ceiling','wall','partition','divider','screen','panel','board','plank','beam','joist','rafter','stud','post','pole','column','pillar','pier','buttress','support','brace','prop','stay','strut','truss','frame','framework','structure','construction','assembly','fabrication','production','manufacture','making','creation','formation','development','growth','evolution','progress','advancement','improvement','betterment','enhancement','enrichment','refinement','polish','finish','completion','conclusion','end','finish','close','termination','cessation','stop','halt','pause','break','interruption','intermission','interval','gap','space','room','place','spot','point','dot','mark','line','dash','stroke','slash','backslash','bracket','brace','parenthesis','comma','period','dot','point','spot','mark','sign','symbol','character','letter','alphabet','type','font','face','script','handwriting','calligraphy','print','impression','stamp','seal','signet','ring','band','circle','cycle','round','circuit','course','route','path','way','track','trail','trace','wake','path','road','street','avenue','boulevard','lane','drive','terrace','place','court','circle','loop','square','plaza','mall','promenade','esplanade','boardwalk','pier','dock','wharf','quay','jetty','landing','mooring','anchorage','harbor','haven','port','marina','basin','dockyard','shipyard','yard','grounds','lawn','garden','park','grove','orchard','vineyard','nursery','greenhouse','hothouse','conservatory','solarium','orangery','aviary','cage','pen','coop','sty','shed','barn','stable','paddock','pasture','meadow','field','lea','vale','valley','dell','dale','glen','ravine','gorge','canyon','pass','notch','gap','col','saddle','ridge','crest','peak','summit','top','pinnacle','apex','zenith','acme','height','altitude','elevation','prominence','eminence','distinction','prestige','status','standing','rank','grade','class','order','sort','kind','type','variety','breed','species','genus','family','tribe','clan','race','strain','stock','line','lineage','pedigree','ancestry','descent','extraction','derivation','origin','source','root','basis','foundation','ground','reason','cause','motive','inducement','incentive','stimulus','spur','goad','prod','push','drive','impulse','urge','force','power','strength','might','energy','vigor','vitality','life','spirit','soul','mind','intellect','brain','head','skull','cranium','face','visage','countenance','features','aspect','look','appearance','guise','semblance','form','shape','figure','outline','profile','silhouette','shadow','shade','darkness','blackness','night','evening','dusk','twilight','gloom','murk','fog','mist','haze','smog','smoke','fume','vapor','steam','gas','air','atmosphere','sky','heaven','firmament','ether','space','void','vacuum','emptiness','nothingness','null','nil','zero','naught','zip','zilch','nada','none','nothing','nobody','noone','neither','nor','not','never','no','yes','yeah','yep','yup','sure','certainly','absolutely','definitely','indeed','exactly','precisely','correct','right','true','truthful','honest','sincere','genuine','authentic','real','actual','true','valid','legitimate','lawful','legal','licit','permitted','allowed','authorized','approved','sanctioned','endorsed','accredited','certified','licensed','registered','chartered','incorporated','established','founded','instituted','organized','formed','created','made','built','constructed','erected','fabricated','manufactured','produced','generated','spawned','begotten','bred','born','delivered','brought','carried','borne','transported','transferred','shifted','moved','relocated','resettled','removed','taken','carried','borne','transported','shipped','sent','mailed','posted','transmitted','conveyed','delivered','handed','passed','transferred','assigned','allotted','allocated','apportioned','distributed','dispensed','shared','divided','split','separated','parted','detached','disconnected','disjoined','disunited','alienated','estranged','withdrawn','removed','abstracted','taken','distracted','diverted','entertained','amused','diverted','recreated','refreshed','restored','renewed','revived','resuscitated','revitalized','reinvigorated','reanimated','reawakened','reborn','regenerated','recreated','reconstructed','rebuilt','restored','reinstated','reestablished','returned','reverted','regressed','retrogressed','relapsed','backslid','lapsed','expired','terminated','ended','ceased','stopped','halted','discontinued','suspended','interrupted','broken','fractured','cracked','split','ruptured','burst','exploded','detonated','ignited','fired','lit','burned','blazed','flamed','glowed','shone','gleamed','glimmered','glittered','sparkled','twinkled','flashed','gleamed','glistened','glistered','glinted','glimpsed','peeped','peeked','peered','gazed','stared','glared','goggled','gawked','gaped','yawned','opened','unclosed','unshut','unbarred','unbolted','unlocked','unfastened','untied','undone','loosed','freed','liberated','released','delivered','rescued','ransomed','redeemed','saved','preserved','kept','held','retained','maintained','sustained','supported','upheld','borne','carried','transported','transmitted','conveyed','communicated','expressed','uttered','spoken','said','told','stated','declared','announced','proclaimed','pronounced','enunciated','articulated','pronounced','uttered','voiced','vocalized','sounded','noised','clattered','clattered','clinked','clanged','rattled','jingled','tinkled','chinked','chimed','tolled','rung','pealed','knolled','sounded','resounded','echoed','reverberated','resonated','vibrated','oscillated','pulsated','pulsed','throbbed','beat','palpitated','fluttered','quivered','trembled','shook','shivered','shuddered','quaked','quavered','wavered','wobbled','tottered','teetered','staggered','reeled','swayed','rocked','rolled','pitched','lurched','heaved','surged','swelled','billowed','waved','undulated','rippled','flowed','fluxed','changed','shifted','altered','varied','modified','adjusted','adapted','fitted','suitable','appropriate','proper','fitting','meet','apt','apposite','relevant','germane','pertinent','applicable','suitable','fitted','adapted','adjusted','accommodated','suited','matched','paired','mated','coupled','yoked','joined','linked','connected','associated','related','correlated','coordinated','integrated','synchronized','harmonized','attuned','adapted','adjusted','tuned','tempered','moderated','regulated','controlled','governed','ruled','commanded','ordered','directed','guided','led','conducted','managed','administered','supervised','overseen','monitored','watched','observed','viewed','seen','beheld','perceived','noticed','noted','marked','remarked','commented','mentioned','cited','quoted','extracted','abstracted','derived','obtained','gotten','acquired','gained','earned','won','achieved','attained','secured','procured','purchased','bought','sold','traded','bartered','exchanged','swapped','substituted','replaced','superseded','supplanted','displaced','ousted','ejected','expelled','evicted','removed','eliminated','eradicated','extirpated','exterminated','destroyed','ruined','wrecked','demolished','devastated','ravaged','desolated','depopulated','emptied','cleared','vacated','abandoned','deserted','forsaken','forlorn','abandoned','deserted','forsaken','forlorn','bereft','deprived','bereaved','grieved','mourned','lamented','bewailed','bemoaned','regretted','repented','atoned','expiated','compensated','indemnified','reimbursed','repaid','restituted','restored','returned','reinstated','replaced','substituted','exchanged','bartered','traded','swapped','switched','shifted','changed','converted','transformed','transmuted','transfigured','metamorphosed','altered','modified','varied','diversified','differentiated','distinguished','discriminated','segregated','separated','isolated','insulated','protected','shielded','guarded','defended','fortified','secured','safeguarded','preserved','conserved','maintained','sustained','supported','upheld','established','instituted','organized','founded','created','made','formed','shaped','molded','fashioned','framed','constructed','built','erected','fabricated','manufactured','produced','generated','spawned','begotten','bred','born','delivered','brought','carried','borne','alice','james','john','michael','sarah','david','emma','alex','max','sam','chris','dan','tom','jack','nick','ryan','mark','paul','luke','adam','jason','kevin','brian','eric','matt','mike','steve','peter','joe','maria','anna','lisa','kate','jane','rachel','laura','emily','sophie','olivia','ella','mia','noah','leo','omar','ali','ahmed','hassan','mohammed','fatima','aisha','ben','nils','denis','alisher','krzysztof','aleksandra','lygin','abu','alaoui','altstein','anthony','ariff','bitomoney','bob','bullishbear','crayola','crypto44','cryptofella','gideon','jopp','cryptomanic','cryptomonk','cryptonova','rishad','cryptocaesar','ctgymrat','degenkenn','dippy','drew','druya','ezmoney','fattony','gemdetector','goomba','hawk','hwmedia','intrepid','justiinape','karamata','kito','lawless','layeralpha','lsd','matteo','gorgonite','mezcez','moneylord','goodie','musa','nite','nilsb','noach','panamax','paw','roshi','rush','satoshiflipper','sharky','soef','sykodelic','tang','tareeq','teddy','alchemist','altcoinsensei','uponlygreg','web3princess','swampmonkey','kenobi','dtcrypto','axeledger','singularity','chadpumpiano','octgems','axe','drprofit','cryptogodjohn','becker','pentoshi','ansem','bluntz','hsaka','cobie','lookonchain','watcherguru','saylor','vitalik','donalt','raoul','arthurhays','zhusu','eliz','murad','kaleo','crediblecrypto','cryptotony','bitboy','larkdavis','cryptobanter','rektcapital','cryptobirb','altcoingordon','cryptowizard','nebraskagooner','degenpoet','inversebrah','gainzy','cryptoyoda','cryptomanran','incomeshark','shark','whale','bull','qflink','qfpad','qfclash','qfstream','nucleusx','quantumnotary','quantum','fusion','quantumfusion','dapp','bridge','governance','admin','treasury','validator','node','swap','stake','pool','vault','dao','nft','token','wallet','vector','nucleus','protocol','network','chain','testnet','mainnet','explorer','faucet','docs','api','sdk','cli','hub','portal','gateway','relay','oracle','index','registry','resolver','registrar','contract','deploy','genesis','block','epoch','shard','main','labs','memechi','usa','uae','dubai','london','newyork','tokyo','singapore','hongkong','europe','africa','asia','australia','canada','germany','france','india','china','korea','japan','brazil','mexico','nigeria','kenya','egypt','saudi','qatar','bahrain','kuwait','oman','jordan','turkey','russia','ukraine','president','potus','congress','senate','government','royal','kingdom','embassy','united','nations','olympic','fifa','minister','chancellor','governor','mayor','official','verified','founder','ceo','cto','developer','engineer','investor','whale','alpha','sigma','chad','degen','hodl','moon','lambo','pump','bear','exchange','market','trade','defi','liquidity','amm','dex','cex','fee','reward','airdrop','vest','mint','burn','lend','borrow','yield','farm','harvest','compound','leverage','margin','futures','options','perps','spot','name','identity','profile','avatar','bio','link','follow','badge','creator','influencer','artist','musician','gamer','streamer','trader','analyst','researcher','binance','coinbase','kraken','metamask','uniswap','opensea','aave','curve','maker','lido','chainlink','compound','dydx','ledger','trezor','phantom','rabby','rainbow','google','apple','amazon','microsoft','meta','tesla','twitter','discord','telegram','reddit','youtube','tiktok','home','root','demo','info','contact','terms','privacy','search','register','renew','manage','settings','web','welcome','help','support','status','blog','news','media','press','team','about','careers','jobs'];

interface ProfileData {
  name: string;
  address: string;
  avatar: string;
  bio: string;
  twitter: string;
  github: string;
  url: string;
  telegram: string;
  expires: bigint;
  registeredAt: bigint;
  isPermanent: boolean;
  exists: boolean;
  isReserved?: boolean;
}

const SOCIAL_CONFIG: Record<string, { icon: React.ReactNode; url: (handle: string) => string; label: string }> = {
  twitter: {
    icon: <Twitter size={18} />,
    url: (handle: string) => {
      // If input already includes a full URL with protocol, use as-is
      if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle;
      }
      // If input includes domain but no protocol, add https://
      if (handle.includes('x.com') || handle.includes('twitter.com')) {
        return `https://${handle}`;
      }
      // Otherwise, construct the URL
      const username = handle.replace(/^@/, '');
      return `https://x.com/${username}`;
    },
    label: 'Twitter',
  },
  github: {
    icon: <Github size={18} />,
    url: (handle: string) => {
      // If input already includes a full URL with protocol, use as-is
      if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle;
      }
      // If input includes domain but no protocol, add https://
      if (handle.includes('github.com')) {
        return `https://${handle}`;
      }
      // Otherwise, construct the URL
      return `https://github.com/${handle}`;
    },
    label: 'GitHub',
  },
  url: {
    icon: <Globe size={18} />,
    url: (handle: string) => {
      // If input already includes http/https, use as-is
      if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle;
      }
      // Otherwise, add https://
      return `https://${handle}`;
    },
    label: 'Website',
  },
  telegram: {
    icon: <Send size={18} />,
    url: (handle: string) => {
      // If input already includes a full URL with protocol, use as-is
      if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle;
      }
      // If input includes domain but no protocol, add https://
      if (handle.includes('t.me')) {
        return `https://${handle}`;
      }
      // If input starts with @, treat as username for Telegram
      if (handle.startsWith('@')) {
        return `https://t.me/${handle.slice(1)}`;
      }
      // Otherwise, assume it's a Telegram username
      return `https://t.me/${handle}`;
    },
    label: 'Telegram',
  },
};

export default function ProfilePage() {
  const { name } = useParams<{ name: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const { copy } = useCopy();

  const [error, setError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Gift modal state
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState('');
  const [senderBalance, setSenderBalance] = useState<bigint>(0n);
  const [isSending, setIsSending] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftSuccess, setGiftSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  // Avatar error state - reset when profile changes
  const [avatarError, setAvatarError] = useState(false);
  
  // Reset avatar error when name changes
  useEffect(() => {
    setAvatarError(false);
  }, [name]);
  
  const { address: senderAddress, connect, connecting } = useWalletStore();

  useEffect(() => {
    if (!name) return;

    const normalizedName = name.toLowerCase().trim().replace(/\.qf$/, '');
    const validation = validateNameLocal(normalizedName);

    if (!validation.valid) {
      setError(validation.error || 'Invalid name');
      setLoading(false);
      return;
    }

    loadProfile(normalizedName);
  }, [name]);

  const loadProfile = async (normalizedName: string) => {
    setLoading(true);
    setError(null);

    try {
      const client = getPublicClient();
      const node = namehash(`${normalizedName}.qf`);

      // Get registration data first to check if name exists
      const registration = await getRegistration(normalizedName);

      if (!registration) {
        // Check if name is reserved
        const isReserved = RESERVED_NAMES_LIST.includes(normalizedName.toLowerCase());
        setProfile({
          name: normalizedName,
          address: '',
          avatar: '',
          bio: '',
          twitter: '',
          github: '',
          url: '',
          telegram: '',
          expires: 0n,
          registeredAt: 0n,
          isPermanent: false,
          exists: false,
          isReserved,
        });
        setLoading(false);
        return;
      }

      // Check if expired (unless permanent)
      const now = BigInt(Math.floor(Date.now() / 1000));
      const isPermanent = registration.expires === 0n;
      const isExpired = !isPermanent && registration.expires < now;

      if (isExpired) {
        setProfile({
          name: normalizedName,
          address: '',
          avatar: '',
          bio: '',
          twitter: '',
          github: '',
          url: '',
          telegram: '',
          expires: registration.expires,
          registeredAt: registration.registeredAt,
          isPermanent: false,
          exists: false,
        });
        setLoading(false);
        return;
      }

      // Fetch resolver data
      const [address, , avatar, bio, twitter, github, url, telegram] = await Promise.all([
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'addr',
            args: [node],
          })
          .catch(() => '0x0000000000000000000000000000000000000000'),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'name',
            args: [node],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'avatar'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'bio'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'twitter'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'github'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'url'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'telegram'],
          })
          .catch(() => ''),
      ]);

      // Debug: Log avatar URL from resolver
      console.log('Avatar URL from resolver:', avatar);
      console.log('Is full URL?', avatar?.startsWith('http') || false);

      setProfile({
        name: normalizedName,
        address: address === '0x0000000000000000000000000000000000000000' ? registration.owner : address,
        avatar: avatar || '',
        bio: bio || '',
        twitter: twitter || '',
        github: github || '',
        url: url || '',
        telegram: telegram || '',
        expires: registration.expires,
        registeredAt: registration.registeredAt,
        isPermanent,
        exists: true,
      });
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: bigint) => {
    if (timestamp === 0n) return 'Unknown';
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleShareCard = () => {
    setShareModalOpen(true);
  };

  const handleCopyLink = async () => {
    if (!profile) return;
    const url = `https://dotqf.xyz/name/${profile.name}`;
    copy(url, false); // Don't show toast for this since we have visual feedback
    hapticTap();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareX = () => {
    if (!profile) return;
    const profileUrl = `https://dotqf.xyz/name/${profile.name}`;
    const text = `Check out my .qf identity on @dotqfns`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank');
  };

  // Gift modal handlers
  const openGiftModal = async () => {
    setGiftModalOpen(true);
    setGiftAmount('');
    setGiftError(null);
    setGiftSuccess(false);
    setTxHash(null);
    if (senderAddress) {
      const balance = await getQFBalance(senderAddress);
      setSenderBalance(balance);
    }
  };

  const closeGiftModal = () => {
    setGiftModalOpen(false);
    setGiftAmount('');
    setGiftError(null);
    setGiftSuccess(false);
    setTxHash(null);
  };

  const handleQuickSelect = (amount: number) => {
    setGiftAmount(amount.toString());
    setGiftError(null);
  };

  const handleSendGift = async () => {
    if (!senderAddress || !profile?.address || !giftAmount) return;
    
    const amount = parseFloat(giftAmount);
    if (isNaN(amount) || amount <= 0) {
      setGiftError('Please enter a valid amount');
      return;
    }

    // Check balance
    const balance = await getQFBalance(senderAddress);
    const requiredAmount = parseEther(giftAmount);
    
    if (balance < requiredAmount) {
      setGiftError('Insufficient QF balance');
      return;
    }

    setIsSending(true);
    setGiftError(null);

    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('No wallet connected');

      const hash = await walletClient.sendTransaction({
        to: profile.address as `0x${string}`,
        value: requiredAmount,
        account: senderAddress,
      });

      setTxHash(hash);
      setGiftSuccess(true);
      hapticSuccess();
    } catch (err: any) {
      console.error('Gift transaction failed:', err);
      
      // Parse error for specific user-friendly messages
      let userMessage = 'Transaction rejected';
      
      if (err.message) {
        const message = err.message.toLowerCase();
        if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
          userMessage = 'Insufficient QF balance';
        } else if (message.includes('rejected') || message.includes('denied') || message.includes('user rejected')) {
          userMessage = 'Transaction rejected';
        }
      }
      
      setGiftError(userMessage);
      hapticError();
    } finally {
      setIsSending(false);
    }
  };

  const handleShareGiftOnX = () => {
    if (!profile || !giftAmount) return;
    const text = `Just gifted ${giftAmount} QF to ${profile.name}.qf on @QFNetwork`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Get available socials
  const availableSocials = profile
    ? Object.entries(SOCIAL_CONFIG).filter(([key]) => profile[key as keyof ProfileData] as string)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00D179] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[#E5484D] mb-4 font-satoshi">{error}</p>
          <Link
            to="/"
            className="text-[#00D179] hover:text-[#00B868] transition-colors font-satoshi"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  // Name is reserved but not assigned
  if (profile?.isReserved) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in">
          <div className="mb-6">
            <span className="font-clash font-bold text-3xl text-white">
              {profile.name}
              <span className="text-[#00D179]">.qf</span>
            </span>
          </div>
          <p className="text-[#8A8A8A] mb-6 font-satoshi text-lg">
            This name is reserved
          </p>
          <Link
            to="/"
            className="inline-block px-8 py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-bold transition-colors duration-200"
          >
            Search for a name
          </Link>
        </div>

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }

  // Name doesn't exist or expired (not reserved)
  if (!profile?.exists) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in">
          <div className="mb-6">
            <span className="font-clash font-bold text-3xl text-white">
              {name}
              <span className="text-[#00D179]">.qf</span>
            </span>
          </div>
          <p className="text-[#8A8A8A] mb-6 font-satoshi text-lg">
            This name hasn't been claimed yet
          </p>
          <Link
            to={`/?search=${encodeURIComponent(profile?.name || '')}`}
            className="inline-block px-8 py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-bold transition-colors duration-200"
          >
            Claim this name
          </Link>
          <div className="mt-8">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200 mx-auto w-fit"
            >
              <ArrowLeft size={16} />
              Back to home
            </Link>
          </div>
        </div>

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#1E1E1E]">
        <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="font-clash font-semibold text-xl text-white tracking-tight hover:opacity-80 transition-opacity"
          >
            QNS<span className="text-[#00D179]">.</span>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Profile Card */}
          <div
            className="rounded-[16px] p-8 relative overflow-hidden border border-[#00D179] bg-[#0A0A0A]"
            style={{ width: '600px', maxWidth: '100%' }}
          >
            {/* Share and Gift icon buttons - top right (desktop only) */}
            <div className="card-buttons absolute top-4 right-4 hidden min-[480px]:flex items-center gap-2 z-20">
              <button
                onClick={openGiftModal}
                className="p-3 rounded-lg text-[#8A8A8A] hover:text-[#00D179] hover:bg-[#1E1E1E] transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Gift QF"
              >
                <Gift size={18} />
              </button>
              <button
                onClick={handleShareCard}
                className="p-3 rounded-lg text-[#8A8A8A] hover:text-white hover:bg-[#1E1E1E] transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Share Card"
              >
                <Share2 size={18} />
              </button>
            </div>

            <div className="relative z-10">
              {/* Mobile: Icons row above name, right-aligned */}
              <div className="flex min-[480px]:hidden justify-end gap-2 mb-4">
                <button
                  onClick={openGiftModal}
                  className="p-3 rounded-lg text-[#8A8A8A] hover:text-[#00D179] hover:bg-[#1E1E1E] transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Gift QF"
                >
                  <Gift size={18} />
                </button>
                <button
                  onClick={handleShareCard}
                  className="p-3 rounded-lg text-[#8A8A8A] hover:text-white hover:bg-[#1E1E1E] transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Share Card"
                >
                  <Share2 size={18} />
                </button>
              </div>

              {/* Name Header */}
              <div className="text-center mb-6">
                <h1 className="font-clash font-bold text-4xl text-white flex items-center justify-center gap-3">
                  {profile.name}
                  <span className="text-[#00D179]">.qf</span>
                </h1>
              </div>

              {/* Avatar */}
              <div className="flex justify-center mb-6">
                {profile.avatar && !avatarError ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-[120px] h-[120px] rounded-full object-cover border-2 border-[#00D179]/30"
                    onError={() => {
                      console.log('Avatar failed to load, falling back to initial letter');
                      setAvatarError(true);
                    }}
                  />
                ) : (
                  <div className="w-[120px] h-[120px] rounded-full bg-[#1a3a2a] flex items-center justify-center border-2 border-[#00D179]">
                    <span className="text-5xl font-clash font-bold text-white">
                      {profile.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-[#8A8A8A] text-center font-satoshi text-base mb-6 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Social Links */}
              {availableSocials.length > 0 && (
                <div className="flex items-center justify-center gap-3 mb-6">
                  {availableSocials.map(([key, config]) => {
                    const value = profile[key as keyof ProfileData] as string;
                    if (!value) return null;
                    return (
                      <a
                        key={key}
                        href={config.url(value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-lg bg-[#0A0A0A] border border-[#1E1E1E] flex items-center justify-center text-[#8A8A8A] hover:text-[#00D179] hover:border-[#00D179]/30 transition-all duration-200 min-w-[44px] min-h-[44px]"
                        title={config.label}
                      >
                        {config.icon}
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Wallet Address */}
              <div className="mb-6">
                <button
                  onClick={() => {
                    copy(profile.address, false); // Don't show toast for this since we have visual feedback
                    hapticTap();
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="w-full bg-transparent rounded-lg px-4 py-3 flex items-center justify-center gap-2 border border-[#1E1E1E] hover:border-[#00D179]/50 transition-colors duration-200"
                >
                  <span className="font-mono text-sm text-[#8A8A8A]">
                    {profile.address.slice(0, 10)}...{profile.address.slice(-6)}
                  </span>
                  {copied ? <Check size={16} className="text-[#00D179]" /> : <Copy size={16} className="text-[#8A8A8A]" />}
                </button>
              </div>

              {/* Registration Info */}
              <div className="flex flex-col items-center gap-2 text-sm mb-6">
                <div className="flex items-center gap-2 text-[#6A6A6A]">
                  <span>Member since {formatDate(profile.registeredAt)}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  {profile.isPermanent ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00D179] bg-[#00D179]/15 px-3 py-1.5 rounded-full">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Permanent
                    </span>
                  ) : (
                    <span className="text-[#00D179] text-xs font-medium bg-[#00D179]/15 px-3 py-1.5 rounded-full">
                      Expires {formatDate(profile.expires)}
                    </span>
                  )}
                  {TEAM_NAMES.includes(profile.name.toLowerCase()) && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D9BF0] bg-[#1D9BF0]/15 px-3 py-1.5 rounded-full">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Team
                    </span>
                  )}
                  {DAPP_LAB_NAMES.includes(profile.name.toLowerCase()) && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00EFE7] bg-[#00EFE7]/15 px-3 py-1.5 rounded-full">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      dApp Lab
                    </span>
                  )}
                </div>
              </div>

              {/* Footer inside the card */}
              <div className="pt-6 border-t border-[#1E1E1E] text-center">
                <div className="inline-flex items-center gap-2 text-sm">
                  <span className="font-clash font-semibold text-white">
                    QNS<span className="text-[#00D179]">.</span>
                  </span>
                  <span className="w-1 h-1 rounded-full bg-[#6A6A6A]" />
                  <span className="text-[#6A6A6A]">Powered by QNS</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Share Modal */}
      {shareModalOpen && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-2xl p-6 max-w-sm w-full animate-fade-in">
            <h3 className="font-clash font-medium text-xl text-white mb-6 text-center">
              Share {profile.name}.qf
            </h3>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-medium transition-colors duration-200"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={handleShareX}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#1E1E1E] text-white hover:bg-[#1E1E1E] transition-colors duration-200"
              >
                <Twitter size={18} />
                Share on X
              </button>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift Modal */}
      {giftModalOpen && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6 max-w-md w-full animate-fade-in">
            {!giftSuccess ? (
              <>
                {/* Recipient Info */}
                <div className="text-center mb-6">
                  <h3 className="font-clash font-medium text-xl text-white mb-1">
                    Gift QF to {profile.name}.qf
                  </h3>
                  <p className="text-sm text-[#8A8A8A] font-mono">
                    {profile.address}
                  </p>
                </div>

                {/* Wallet Connection Check */}
                {!senderAddress ? (
                  <div className="text-center py-4">
                    <p className="text-[#8A8A8A] mb-4">
                      Connect wallet to send a gift
                    </p>
                    <button
                      onClick={connect}
                      disabled={connecting}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-medium transition-colors duration-200 disabled:opacity-50"
                    >
                      {connecting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : null}
                      {connecting ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Amount Input */}
                    <div className="mb-4">
                      <div className="relative">
                        <input
                          type="number"
                          value={giftAmount}
                          onChange={(e) => {
                            setGiftAmount(e.target.value);
                            setGiftError(null);
                          }}
                          placeholder="Enter amount"
                          min="0"
                          step="0.01"
                          className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white font-satoshi focus:outline-none focus:border-[#00D179] transition-colors"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] font-medium">
                          QF
                        </span>
                      </div>
                    </div>

                    {/* Quick Select Buttons */}
                    <div className="flex items-center gap-2 mb-4">
                      {[10, 50, 100, 500].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => handleQuickSelect(amount)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            giftAmount === amount.toString()
                              ? 'bg-[#00D179] text-black'
                              : 'bg-[#1E1E1E] text-[#8A8A8A] hover:text-[#00D179]'
                          }`}
                        >
                          {amount} QF
                        </button>
                      ))}
                    </div>

                    {/* Balance Display */}
                    <div className="mb-4 text-center">
                      <span className="text-sm text-[#8A8A8A]">
                        Your balance: <span className="text-white font-medium">{formatQF(senderBalance)} QF</span>
                      </span>
                    </div>

                    {/* Error Message */}
                    {giftError && (
                      <p className="text-center text-[#E5484D] text-sm mb-4">
                        {giftError}
                      </p>
                    )}

                    {/* Send Gift Button */}
                    <button
                      onClick={handleSendGift}
                      disabled={isSending || !giftAmount}
                      className="w-full py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-medium transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSending ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : null}
                      {isSending ? 'Sending...' : 'Send Gift'}
                    </button>
                  </>
                )}

                {/* Close Button */}
                <button
                  onClick={closeGiftModal}
                  className="w-full text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200 py-2 mt-3"
                >
                  Close
                </button>
              </>
            ) : (
              /* Success Screen */
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00D179]/20 flex items-center justify-center">
                  <Check size={32} className="text-[#00D179]" />
                </div>
                <h3 className="font-clash font-medium text-xl text-white mb-2">
                  You sent {giftAmount} QF to {profile.name}.qf!
                </h3>
                {txHash && (
                  <p className="text-sm text-[#8A8A8A] font-mono mb-4 break-all">
                    {txHash.slice(0, 20)}...{txHash.slice(-8)}
                  </p>
                )}
                <div className="flex flex-col gap-3 mt-6">
                  <button
                    onClick={handleShareGiftOnX}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#1E1E1E] text-white hover:bg-[#1E1E1E] transition-colors duration-200"
                  >
                    <Twitter size={18} />
                    Share on X
                  </button>
                  <button
                    onClick={closeGiftModal}
                    className="text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200 py-2"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
