/* global HTMLElement */
/* global self */

export default class YjsChatUpdate extends HTMLElement {
  constructor (...args) {
    super(...args)

    this.attachShadow({ mode: 'open' })
    const ul = document.createElement('ul')
    this.shadowRoot.innerHTML = `
      <style>
        :host > ul {
          margin: 0;
          padding: 0;
        }
        :host > ul > li {
          background-color: lightgray;
          border-radius: 0.5em;
          float: left;
          list-style: none;
          padding: 1em;
          margin: 0.25em 0.1em 0.25em 0;
          width: 80%;
        }
        :host > ul > li.self {
          background-color: lightgreen;
          float: right;
        }
        :host > ul > li > .user, :host > ul > li > .timestamp {
          color: gray;
          font-size: 0.8em;
        }
        :host > ul > li > span {
          word-break: break-word;
        }
        :host > ul > li span.peer-web-site {
          font-size: 0.8em;
        }
        :host > ul > li > .timestamp {
          font-size: 0.6em;
        }
      </style>
    `
    this.shadowRoot.appendChild(ul)
    this.timeoutID = null
    // chat update
    this.eventListener = event => {
      const isScrolledBottom = this.scrollHeight < this.scrollTop + this.offsetHeight + 200 /* tollerance */
      let lastEntryIsSelf = false
      let lastMessage = null
      ul.innerHTML = ''
      event.detail.chat.sort((a, b) => a.timestamp - b.timestamp).forEach((entry, i, chat) => {
        const li = document.createElement('li')
        if (entry.isSelf) li.classList.add('self')
        // make aTags with href when first link is detected (TODO: does it only for the first link in an entry)
        let match
        if ((match = entry.text.match(this.urlPattern)) && (match = match[0])) entry.text = entry.text.replace((match = match.trim()), `<a href="${match}" target="_blank">${match}</a>`)
        li.innerHTML = `<span class="user">${entry.nickname}: </span><br><span class="text">${entry.text}</span><br><span class="timestamp">${(new Date(entry.timestamp)).toLocaleString(navigator.language)}</span>`
        ul.appendChild(li)
        if (chat.length === i + 1 && entry.isSelf) lastEntryIsSelf = true
        if (chat.length === i + 1) lastMessage = entry
      })
      // scroll to new entry
      if (lastEntryIsSelf || isScrolledBottom) this.scroll(0, this.scrollHeight)
      // notification
      if (lastMessage && this.registration && !lastEntryIsSelf) {
        this.registration.active.postMessage(`{
        "nickname": "${lastMessage.nickname}",
        "text": "${lastMessage.text}",
        "visibilityState": "${document.visibilityState}"
      }`)
      }
    }
  }

  connectedCallback () {
    document.body.addEventListener('yjs-chat-update', this.eventListener)
    // wait shortly with registering also until the first message sync happend, which certainly could be solved nicer than with a timeout
    setTimeout(() => {
      // use a service worker for notifications
      // Service Worker
      this.registration = null
      navigator.serviceWorker.register('./MasterServiceWorker.js', { scope: './' }).then(registration => {
        self.Notification.requestPermission(result => {
          if (result === 'granted') this.registration = registration
        })
        registration.update()
      }).catch(error => console.error(error))
    }, 3000)
  }

  disconnectedCallback () {
    document.body.removeEventListener('yjs-chat-update', this.eventListener)
  }

  // https://github.com/meyt/linkable.js/blob/master/src/patterns.js#L21
  get urlPattern () {
    const ipMiddleOctet = '(\\.(1?\\d{1,2}|2[0-4]\\d|25[0-5]))'
    const ipLastOctet = '(\\.([1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))'
    return new RegExp(
      // protocol identifier
      '((https?|ftp):\\/\\/)?' +
      // user:pass authentication
      '([-a-z\u00a1-\uffff0-9._~%!$&\'(\\)*+,;=:]+' +
      '(:[-a-z0-9._~%!$&\'()*+,;=:]*)?@)?' +
      '(' +
      // IP address exclusion
      // private & local networks
      '((10|127)' + ipMiddleOctet + '{2}' + ipLastOctet + ')|' +
      '((169\\.254|192\\.168)' + ipMiddleOctet + ipLastOctet + ')|' +
      '(172\\.(1[6-9]|2\\d|3[0-1])' + ipMiddleOctet + ipLastOctet + ')' +
      '|' +
      // private & local hosts
      '(localhost)' +
      '|' +
      // IP address dotted notation octets
      // excludes loopback network 0.0.0.0
      // excludes reserved space >= 224.0.0.0
      // excludes network & broadcast addresses
      // (first & last IP address of each class)
      '([1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' +
      '' + ipMiddleOctet + '{2}' +
      '' + ipLastOctet +
      // '(\\.(1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' +
      // '(\\.([1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' +
      '|' +
      // IPv6 RegEx from https://stackoverflow.com/a/17871737
      '\\[(' +
      // 1:2:3:4:5:6:7:8
      '([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|' +
      //  1::                              1:2:3:4:5:6:7::
      '([0-9a-fA-F]{1,4}:){1,7}:|' +
      // 1::8             1:2:3:4:5:6::8  1:2:3:4:5:6::8
      '([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|' +
      // 1::7:8           1:2:3:4:5::7:8  1:2:3:4:5::8
      '([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|' +
      // 1::6:7:8         1:2:3:4::6:7:8  1:2:3:4::8
      '([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|' +
      // 1::5:6:7:8       1:2:3::5:6:7:8  1:2:3::8
      '([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|' +
      // 1::4:5:6:7:8     1:2::4:5:6:7:8  1:2::8
      '([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|' +
      // 1::3:4:5:6:7:8   1::3:4:5:6:7:8  1::8
      '[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|' +
      // ::2:3:4:5:6:7:8  ::2:3:4:5:6:7:8 ::8       ::
      ':((:[0-9a-fA-F]{1,4}){1,7}|:)|' +
      // fe80::7:8%eth0   fe80::7:8%1
      // (link-local IPv6 addresses with zone index)
      'fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|' +
      '::(ffff(:0{1,4}){0,1}:){0,1}' +
      '((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}' +
      // ::255.255.255.255   ::ffff:255.255.255.255  ::ffff:0:255.255.255.255
      // (IPv4-mapped IPv6 addresses and IPv4-translated addresses)
      '(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|' +
      '([0-9a-fA-F]{1,4}:){1,4}:' +
      '((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}' +
      // 2001:db8:3:4::192.0.2.33  64:ff9b::192.0.2.33
      // (IPv4-Embedded IPv6 Address)
      '(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])' +
      ')\\]|' +
      // host name
      '(([a-z\u00a1-\uffff0-9]-?)*[a-z\u00a1-\uffff0-9]+)' +
      // domain name
      '(\\.([a-z\u00a1-\uffff0-9]-?)*[a-z\u00a1-\uffff0-9]+)*' +
      // TLD identifier
      '(\\.(?:' + 'AAA|AARP|ABARTH|ABB|ABBOTT|ABBVIE|ABC|ABLE|ABOGADO|ABUDHABI|AC|ACADEMY|ACCENTURE|ACCOUNTANT|ACCOUNTANTS|ACO|ACTOR|AD|ADAC|ADS|ADULT|AE|AEG|AERO|AETNA|AF|AFAMILYCOMPANY|AFL|AFRICA|AG|AGAKHAN|AGENCY|AI|AIG|AIGO|AIRBUS|AIRFORCE|AIRTEL|AKDN|AL|ALFAROMEO|ALIBABA|ALIPAY|ALLFINANZ|ALLSTATE|ALLY|ALSACE|ALSTOM|AM|AMERICANEXPRESS|AMERICANFAMILY|AMEX|AMFAM|AMICA|AMSTERDAM|ANALYTICS|ANDROID|ANQUAN|ANZ|AO|AOL|APARTMENTS|APP|APPLE|AQ|AQUARELLE|AR|ARAB|ARAMCO|ARCHI|ARMY|ARPA|ART|ARTE|AS|ASDA|ASIA|ASSOCIATES|AT|ATHLETA|ATTORNEY|AU|AUCTION|AUDI|AUDIBLE|AUDIO|AUSPOST|AUTHOR|AUTO|AUTOS|AVIANCA|AW|AWS|AX|AXA|AZ|AZURE|BA|BABY|BAIDU|BANAMEX|BANANAREPUBLIC|BAND|BANK|BAR|BARCELONA|BARCLAYCARD|BARCLAYS|BAREFOOT|BARGAINS|BASEBALL|BASKETBALL|BAUHAUS|BAYERN|BB|BBC|BBT|BBVA|BCG|BCN|BD|BE|BEATS|BEAUTY|BEER|BENTLEY|BERLIN|BEST|BESTBUY|BET|BF|BG|BH|BHARTI|BI|BIBLE|BID|BIKE|BING|BINGO|BIO|BIZ|BJ|BLACK|BLACKFRIDAY|BLOCKBUSTER|BLOG|BLOOMBERG|BLUE|BM|BMS|BMW|BN|BNL|BNPPARIBAS|BO|BOATS|BOEHRINGER|BOFA|BOM|BOND|BOO|BOOK|BOOKING|BOSCH|BOSTIK|BOSTON|BOT|BOUTIQUE|BOX|BR|BRADESCO|BRIDGESTONE|BROADWAY|BROKER|BROTHER|BRUSSELS|BS|BT|BUDAPEST|BUGATTI|BUILD|BUILDERS|BUSINESS|BUY|BUZZ|BV|BW|BY|BZ|BZH|CA|CAB|CAFE|CAL|CALL|CALVINKLEIN|CAM|CAMERA|CAMP|CANCERRESEARCH|CANON|CAPETOWN|CAPITAL|CAPITALONE|CAR|CARAVAN|CARDS|CARE|CAREER|CAREERS|CARS|CARTIER|CASA|CASE|CASEIH|CASH|CASINO|CAT|CATERING|CATHOLIC|CBA|CBN|CBRE|CBS|CC|CD|CEB|CENTER|CEO|CERN|CF|CFA|CFD|CG|CH|CHANEL|CHANNEL|CHARITY|CHASE|CHAT|CHEAP|CHINTAI|CHRISTMAS|CHROME|CHRYSLER|CHURCH|CI|CIPRIANI|CIRCLE|CISCO|CITADEL|CITI|CITIC|CITY|CITYEATS|CK|CL|CLAIMS|CLEANING|CLICK|CLINIC|CLINIQUE|CLOTHING|CLOUD|CLUB|CLUBMED|CM|CN|CO|COACH|CODES|COFFEE|COLLEGE|COLOGNE|COM|COMCAST|COMMBANK|COMMUNITY|COMPANY|COMPARE|COMPUTER|COMSEC|CONDOS|CONSTRUCTION|CONSULTING|CONTACT|CONTRACTORS|COOKING|COOKINGCHANNEL|COOL|COOP|CORSICA|COUNTRY|COUPON|COUPONS|COURSES|CR|CREDIT|CREDITCARD|CREDITUNION|CRICKET|CROWN|CRS|CRUISE|CRUISES|CSC|CU|CUISINELLA|CV|CW|CX|CY|CYMRU|CYOU|CZ|DABUR|DAD|DANCE|DATA|DATE|DATING|DATSUN|DAY|DCLK|DDS|DE|DEAL|DEALER|DEALS|DEGREE|DELIVERY|DELL|DELOITTE|DELTA|DEMOCRAT|DENTAL|DENTIST|DESI|DESIGN|DEV|DHL|DIAMONDS|DIET|DIGITAL|DIRECT|DIRECTORY|DISCOUNT|DISCOVER|DISH|DIY|DJ|DK|DM|DNP|DO|DOCS|DOCTOR|DODGE|DOG|DOMAINS|DOT|DOWNLOAD|DRIVE|DTV|DUBAI|DUCK|DUNLOP|DUNS|DUPONT|DURBAN|DVAG|DVR|DZ|EARTH|EAT|EC|ECO|EDEKA|EDU|EDUCATION|EE|EG|EMAIL|EMERCK|ENERGY|ENGINEER|ENGINEERING|ENTERPRISES|EPSON|EQUIPMENT|ER|ERICSSON|ERNI|ES|ESQ|ESTATE|ESURANCE|ET|ETISALAT|EU|EUROVISION|EUS|EVENTS|EVERBANK|EXCHANGE|EXPERT|EXPOSED|EXPRESS|EXTRASPACE|FAGE|FAIL|FAIRWINDS|FAITH|FAMILY|FAN|FANS|FARM|FARMERS|FASHION|FAST|FEDEX|FEEDBACK|FERRARI|FERRERO|FI|FIAT|FIDELITY|FIDO|FILM|FINAL|FINANCE|FINANCIAL|FIRE|FIRESTONE|FIRMDALE|FISH|FISHING|FIT|FITNESS|FJ|FK|FLICKR|FLIGHTS|FLIR|FLORIST|FLOWERS|FLY|FM|FO|FOO|FOOD|FOODNETWORK|FOOTBALL|FORD|FOREX|FORSALE|FORUM|FOUNDATION|FOX|FR|FREE|FRESENIUS|FRL|FROGANS|FRONTDOOR|FRONTIER|FTR|FUJITSU|FUJIXEROX|FUN|FUND|FURNITURE|FUTBOL|FYI|GA|GAL|GALLERY|GALLO|GALLUP|GAME|GAMES|GAP|GARDEN|GB|GBIZ|GD|GDN|GE|GEA|GENT|GENTING|GEORGE|GF|GG|GGEE|GH|GI|GIFT|GIFTS|GIVES|GIVING|GL|GLADE|GLASS|GLE|GLOBAL|GLOBO|GM|GMAIL|GMBH|GMO|GMX|GN|GODADDY|GOLD|GOLDPOINT|GOLF|GOO|GOODYEAR|GOOG|GOOGLE|GOP|GOT|GOV|GP|GQ|GR|GRAINGER|GRAPHICS|GRATIS|GREEN|GRIPE|GROCERY|GROUP|GS|GT|GU|GUARDIAN|GUCCI|GUGE|GUIDE|GUITARS|GURU|GW|GY|HAIR|HAMBURG|HANGOUT|HAUS|HBO|HDFC|HDFCBANK|HEALTH|HEALTHCARE|HELP|HELSINKI|HERE|HERMES|HGTV|HIPHOP|HISAMITSU|HITACHI|HIV|HK|HKT|HM|HN|HOCKEY|HOLDINGS|HOLIDAY|HOMEDEPOT|HOMEGOODS|HOMES|HOMESENSE|HONDA|HORSE|HOSPITAL|HOST|HOSTING|HOT|HOTELES|HOTELS|HOTMAIL|HOUSE|HOW|HR|HSBC|HT|HU|HUGHES|HYATT|HYUNDAI|IBM|ICBC|ICE|ICU|ID|IE|IEEE|IFM|IKANO|IL|IM|IMAMAT|IMDB|IMMO|IMMOBILIEN|IN|INC|INDUSTRIES|INFINITI|INFO|ING|INK|INSTITUTE|INSURANCE|INSURE|INT|INTEL|INTERNATIONAL|INTUIT|INVESTMENTS|IO|IPIRANGA|IQ|IR|IRISH|IS|ISELECT|ISMAILI|IST|ISTANBUL|IT|ITAU|ITV|IVECO|JAGUAR|JAVA|JCB|JCP|JE|JEEP|JETZT|JEWELRY|JIO|JLL|JM|JMP|JNJ|JO|JOBS|JOBURG|JOT|JOY|JP|JPMORGAN|JPRS|JUEGOS|JUNIPER|KAUFEN|KDDI|KE|KERRYHOTELS|KERRYLOGISTICS|KERRYPROPERTIES|KFH|KG|KH|KI|KIA|KIM|KINDER|KINDLE|KITCHEN|KIWI|KM|KN|KOELN|KOMATSU|KOSHER|KP|KPMG|KPN|KR|KRD|KRED|KUOKGROUP|KW|KY|KYOTO|KZ|LA|LACAIXA|LADBROKES|LAMBORGHINI|LAMER|LANCASTER|LANCIA|LANCOME|LAND|LANDROVER|LANXESS|LASALLE|LAT|LATINO|LATROBE|LAW|LAWYER|LB|LC|LDS|LEASE|LECLERC|LEFRAK|LEGAL|LEGO|LEXUS|LGBT|LI|LIAISON|LIDL|LIFE|LIFEINSURANCE|LIFESTYLE|LIGHTING|LIKE|LILLY|LIMITED|LIMO|LINCOLN|LINDE|LINK|LIPSY|LIVE|LIVING|LIXIL|LK|LLC|LOAN|LOANS|LOCKER|LOCUS|LOFT|LOL|LONDON|LOTTE|LOTTO|LOVE|LPL|LPLFINANCIAL|LR|LS|LT|LTD|LTDA|LU|LUNDBECK|LUPIN|LUXE|LUXURY|LV|LY|MA|MACYS|MADRID|MAIF|MAISON|MAKEUP|MAN|MANAGEMENT|MANGO|MAP|MARKET|MARKETING|MARKETS|MARRIOTT|MARSHALLS|MASERATI|MATTEL|MBA|MC|MCKINSEY|MD|ME|MED|MEDIA|MEET|MELBOURNE|MEME|MEMORIAL|MEN|MENU|MERCKMSD|METLIFE|MG|MH|MIAMI|MICROSOFT|MIL|MINI|MINT|MIT|MITSUBISHI|MK|ML|MLB|MLS|MM|MMA|MN|MO|MOBI|MOBILE|MOBILY|MODA|MOE|MOI|MOM|MONASH|MONEY|MONSTER|MOPAR|MORMON|MORTGAGE|MOSCOW|MOTO|MOTORCYCLES|MOV|MOVIE|MOVISTAR|MP|MQ|MR|MS|MSD|MT|MTN|MTR|MU|MUSEUM|MUTUAL|MV|MW|MX|MY|MZ|NA|NAB|NADEX|NAGOYA|NAME|NATIONWIDE|NATURA|NAVY|NBA|NC|NE|NEC|NET|NETBANK|NETFLIX|NETWORK|NEUSTAR|NEW|NEWHOLLAND|NEWS|NEXT|NEXTDIRECT|NEXUS|NF|NFL|NG|NGO|NHK|NI|NICO|NIKE|NIKON|NINJA|NISSAN|NISSAY|NL|NO|NOKIA|NORTHWESTERNMUTUAL|NORTON|NOW|NOWRUZ|NOWTV|NP|NR|NRA|NRW|NTT|NU|NYC|NZ|OBI|OBSERVER|OFF|OFFICE|OKINAWA|OLAYAN|OLAYANGROUP|OLDNAVY|OLLO|OM|OMEGA|ONE|ONG|ONL|ONLINE|ONYOURSIDE|OOO|OPEN|ORACLE|ORANGE|ORG|ORGANIC|ORIGINS|OSAKA|OTSUKA|OTT|OVH|PA|PAGE|PANASONIC|PARIS|PARS|PARTNERS|PARTS|PARTY|PASSAGENS|PAY|PCCW|PE|PET|PF|PFIZER|PG|PH|PHARMACY|PHD|PHILIPS|PHONE|PHOTO|PHOTOGRAPHY|PHOTOS|PHYSIO|PIAGET|PICS|PICTET|PICTURES|PID|PIN|PING|PINK|PIONEER|PIZZA|PK|PL|PLACE|PLAY|PLAYSTATION|PLUMBING|PLUS|PM|PN|PNC|POHL|POKER|POLITIE|PORN|POST|PR|PRAMERICA|PRAXI|PRESS|PRIME|PRO|PROD|PRODUCTIONS|PROF|PROGRESSIVE|PROMO|PROPERTIES|PROPERTY|PROTECTION|PRU|PRUDENTIAL|PS|PT|PUB|PW|PWC|PY|QA|QPON|QUEBEC|QUEST|QVC|RACING|RADIO|RAID|RE|READ|REALESTATE|REALTOR|REALTY|RECIPES|RED|REDSTONE|REDUMBRELLA|REHAB|REISE|REISEN|REIT|RELIANCE|REN|RENT|RENTALS|REPAIR|REPORT|REPUBLICAN|REST|RESTAURANT|REVIEW|REVIEWS|REXROTH|RICH|RICHARDLI|RICOH|RIGHTATHOME|RIL|RIO|RIP|RMIT|RO|ROCHER|ROCKS|RODEO|ROGERS|ROOM|RS|RSVP|RU|RUGBY|RUHR|RUN|RW|RWE|RYUKYU|SA|SAARLAND|SAFE|SAFETY|SAKURA|SALE|SALON|SAMSCLUB|SAMSUNG|SANDVIK|SANDVIKCOROMANT|SANOFI|SAP|SARL|SAS|SAVE|SAXO|SB|SBI|SBS|SC|SCA|SCB|SCHAEFFLER|SCHMIDT|SCHOLARSHIPS|SCHOOL|SCHULE|SCHWARZ|SCIENCE|SCJOHNSON|SCOR|SCOT|SD|SE|SEARCH|SEAT|SECURE|SECURITY|SEEK|SELECT|SENER|SERVICES|SES|SEVEN|SEW|SEX|SEXY|SFR|SG|SH|SHANGRILA|SHARP|SHAW|SHELL|SHIA|SHIKSHA|SHOES|SHOP|SHOPPING|SHOUJI|SHOW|SHOWTIME|SHRIRAM|SI|SILK|SINA|SINGLES|SITE|SJ|SK|SKI|SKIN|SKY|SKYPE|SL|SLING|SM|SMART|SMILE|SN|SNCF|SO|SOCCER|SOCIAL|SOFTBANK|SOFTWARE|SOHU|SOLAR|SOLUTIONS|SONG|SONY|SOY|SPACE|SPORT|SPOT|SPREADBETTING|SR|SRL|SRT|SS|ST|STADA|STAPLES|STAR|STARHUB|STATEBANK|STATEFARM|STC|STCGROUP|STOCKHOLM|STORAGE|STORE|STREAM|STUDIO|STUDY|STYLE|SU|SUCKS|SUPPLIES|SUPPLY|SUPPORT|SURF|SURGERY|SUZUKI|SV|SWATCH|SWIFTCOVER|SWISS|SX|SY|SYDNEY|SYMANTEC|SYSTEMS|SZ|TAB|TAIPEI|TALK|TAOBAO|TARGET|TATAMOTORS|TATAR|TATTOO|TAX|TAXI|TC|TCI|TD|TDK|TEAM|TECH|TECHNOLOGY|TEL|TELEFONICA|TEMASEK|TENNIS|TEVA|TF|TG|TH|THD|THEATER|THEATRE|TIAA|TICKETS|TIENDA|TIFFANY|TIPS|TIRES|TIROL|TJ|TJMAXX|TJX|TK|TKMAXX|TL|TM|TMALL|TN|TO|TODAY|TOKYO|TOOLS|TOP|TORAY|TOSHIBA|TOTAL|TOURS|TOWN|TOYOTA|TOYS|TR|TRADE|TRADING|TRAINING|TRAVEL|TRAVELCHANNEL|TRAVELERS|TRAVELERSINSURANCE|TRUST|TRV|TT|TUBE|TUI|TUNES|TUSHU|TV|TVS|TW|TZ|UA|UBANK|UBS|UCONNECT|UG|UK|UNICOM|UNIVERSITY|UNO|UOL|UPS|US|UY|UZ|VA|VACATIONS|VANA|VANGUARD|VC|VE|VEGAS|VENTURES|VERISIGN|VERSICHERUNG|VET|VG|VI|VIAJES|VIDEO|VIG|VIKING|VILLAS|VIN|VIP|VIRGIN|VISA|VISION|VISTAPRINT|VIVA|VIVO|VLAANDEREN|VN|VODKA|VOLKSWAGEN|VOLVO|VOTE|VOTING|VOTO|VOYAGE|VU|VUELOS|WALES|WALMART|WALTER|WANG|WANGGOU|WARMAN|WATCH|WATCHES|WEATHER|WEATHERCHANNEL|WEBCAM|WEBER|WEBSITE|WED|WEDDING|WEIBO|WEIR|WF|WHOSWHO|WIEN|WIKI|WILLIAMHILL|WIN|WINDOWS|WINE|WINNERS|WME|WOLTERSKLUWER|WOODSIDE|WORK|WORKS|WORLD|WOW|WS|WTC|WTF|XBOX|XEROX|XFINITY|XIHUAN|XIN|कॉम|セール|佛山|ಭಾರತ|慈善|集团|在线|한국|ଭାରତ|大众汽车|点看|คอม|ভাৰত|ভারত|八卦|موقع|বাংলা|公益|公司|香格里拉|网站|移动|我爱你|москва|қаз|католик|онлайн|сайт|联通|срб|бг|бел|קום|时尚|微博|淡马锡|ファッション|орг|नेट|ストア|삼성|சிங்கப்பூர்|商标|商店|商城|дети|мкд|ею|ポイント|新闻|工行|家電|كوم|中文网|中信|中国|中國|娱乐|谷歌|భారత్|ලංකා|電訊盈科|购物|クラウド|ભારત|通販|भारतम्|भारत|भारोत|网店|संगठन|餐厅|网络|ком|укр|香港|诺基亚|食品|飞利浦|台湾|台灣|手表|手机|мон|الجزائر|عمان|ارامكو|ایران|العليان|اتصالات|امارات|بازار|موريتانيا|پاکستان|الاردن|موبايلي|بارت|بھارت|المغرب|ابوظبي|السعودية|ڀارت|كاثوليك|سودان|همراه|عراق|مليسيا|澳門|닷컴|政府|شبكة|بيتك|عرب|გე|机构|组织机构|健康|ไทย|سورية|招聘|рус|рф|珠宝|تونس|大拿|みんな|グーグル|ελ|世界|書籍|ഭാരതം|ਭਾਰਤ|网址|닷넷|コム|天主教|游戏|VERMöGENSBERATER|VERMöGENSBERATUNG|企业|信息|嘉里大酒店|嘉里|مصر|قطر|广东|இலங்கை|இந்தியா|հայ|新加坡|فلسطين|政务|XXX|XYZ|YACHTS|YAHOO|YAMAXUN|YANDEX|YE|YODOBASHI|YOGA|YOKOHAMA|YOU|YOUTUBE|YT|YUN|ZA|ZAPPOS|ZARA|ZERO|ZIP|ZM|ZONE|ZUERICH|ZW' + '|test|localhost))' +
      ')' +
      // port number
      '(:\\d{2,5})?' +
      // resource path
      '(/[-a-z\u00a1-\uffff0-9._~%!$&\'(\\)*+,;=:@/]*)?' +
      // query string
      '(\\?\\S*)?' +
      // fragment
      '(#\\S*)?' + '[^s\n]{0,1}', 'ui'
    )
  }
}
