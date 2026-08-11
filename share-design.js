(() => {
  const deepFreeze=value=>{
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };
  const design=deepFreeze({
    features:{shareCardPublicLink:false},
    assets:{motherIllustration:'./assets/share-mother.png?v=1.9.0'},
    ui:{
      light:{coral:'#d96f63',coralDeep:'#b6534c',peach:'#f7c9b8',coralSoft:'rgba(217,111,99,.14)',buttonText:'#ffffff'},
      dark:{coral:'#f09a8e',coralDeep:'#ffb0a6',peach:'#7a4d49',coralSoft:'rgba(240,154,142,.18)',buttonText:'#3b2321'},
      space:{xs:'4px',sm:'8px',md:'12px',lg:'16px',xl:'20px',dialog:'22px'},
      radius:{control:'13px',button:'18px',card:'28px',dialog:'30px',preview:'24px'},
      type:{micro:'10px',small:'11px',body:'12px',label:'14px',dialogTitle:'25px'},
      motion:{fast:'150ms',normal:'180ms'},
      shadow:{button:'0 9px 22px color-mix(in srgb,var(--share-coral) 22%,transparent)',dialog:'0 28px 90px rgba(0,0,0,.28)',preview:'0 18px 42px rgba(27,40,58,.10)'},
      component:{
        entryGradientAngle:'145deg',entryMix:'72%',entryBorderMix:'18%',letterTight:'-.015em',lineHeightBody:'1.5',buttonHeight:'50px',buttonGradientAngle:'130deg',buttonGradientStop:'52%',fontStrong:'780',iconSize:'18px',iconStroke:'1.8',hoverSaturation:'.92',hoverBrightness:'1.03',activeScale:'.985',focusWidth:'3px',focusOffset:'3px',disabledSurface:'rgba(127,127,127,.12)',descriptionWeight:'650',dotSize:'6px',auxHeight:'34px',auxBorderMix:'25%',auxHoverMix:'70%',auxActiveScale:'.97',disabledOpacity:'.45',
        lineWidth:'1px',entryPaddingY:'18px',buttonPaddingY:'14px',buttonPaddingX:'18px',buttonGap:'9px',hintGap:'7px',auxGap:'5px',auxPadY:'7px',auxPadX:'11px',dialogHeadMargin:'18px',eyebrowMargin:'5px',optionPadY:'11px',optionPadX:'13px',privacyMargin:'13px',actionGap:'9px',helperMargin:'11px',statusPadY:'11px',statusPadX:'13px',mobilePadY:'18px',
        dialogMaxWidth:'720px',dialogMaxHeight:'900px',dialogViewport:'92svh',dialogBackdrop:'rgba(13,18,26,.52)',dialogBlur:'10px',eyebrowTracking:'.12em',titleTracking:'-.035em',closeSize:'38px',closeFont:'22px',neutralSoft:'rgba(127,127,127,.08)',optionHeight:'48px',optionRadius:'16px',optionSurface:'rgba(127,127,127,.045)',switchWidth:'37px',switchHeight:'22px',switchKnob:'18px',switchOffset:'2px',switchRadius:'999px',switchTranslate:'15px',switchShadow:'0 1px 4px rgba(0,0,0,.22)',generateRadius:'17px',generateDisabledOpacity:'.55',previewMaxWidth:'420px',previewImageRadius:'17px',previewImageSurface:'#f4f9ff',previewSurfaceMix:'5%',actionHeight:'45px',actionRadius:'15px',actionSurface:'rgba(127,127,127,.07)',actionWeight:'720',statusRadius:'14px',warningSurface:'rgba(255,149,0,.12)',warningText:'#b96800',warningTextDark:'#ffb340',dialogDark:'#1b1d21',previewDark:'rgba(255,255,255,.035)',mobileDialogViewport:'94svh',mobilePreviewWidth:'370px',lineHeightCopy:'1.6',lineHeightPrivacy:'1.55'
      }
    },
    card:{
      width:1080,height:1440,font:'-apple-system,BlinkMacSystemFont,"Microsoft YaHei","PingFang SC",Arial,sans-serif',
      colors:{
        text:'#4a302d',white:'#fffdf8',heading:'#553833',muted:'#876f68',subtle:'#9a8178',statLabel:'#956f65',qrCaption:'#735a53',
        coral:'#d9786f',coralDeep:'#c75f56',coralText:'#a84d47',peach:'#f3bda9',peachSoft:'rgba(243,189,169,.30)',peachLine:'rgba(199,95,86,.15)',
        green:'#7ead88',greenText:'#557e60',greenSoft:'rgba(126,173,136,.18)',greenLine:'rgba(88,126,97,.17)',
        doctor:'#8b6aae',doctorSoft:'rgba(139,106,174,.17)',panel:'rgba(255,253,247,.94)',statPanel:'rgba(255,246,235,.86)',statPeach:'rgba(250,226,211,.72)',statGreen:'rgba(238,239,215,.72)',
        backgroundStart:'#fbf4e9',backgroundMiddle:'#fff9ef',backgroundEnd:'#f8efe4',glow:'rgba(243,189,169,.34)',glowClear:'rgba(243,189,169,0)',line:'rgba(119,83,72,.12)',link:'#a6544d',texture:'rgba(123,91,73,.035)',decorGreen:'rgba(126,173,136,.15)',motherLine:'rgba(199,95,86,.52)',heartCoral:'rgba(217,120,111,.68)',heartGreen:'rgba(126,173,136,.78)',currentLine:'rgba(199,95,86,.42)'
      },
      type:{product:21,title:52,subtitle:22,week:28,statLabel:19,statValue:35,section:28,status:28,note:19,brand:30,url:18,legal:18,qr:17},
      layout:{
        safe:72,panelWidth:936,productY:78,titleY:158,titleUnderlineY:181,subtitleY:213,weekY:229,weekWidth:190,weekHeight:48,weekRadius:24,weekTextY:261,
        statsDefaultY:278,statsWithWeekY:302,statsGap:16,statHeight:126,statRadius:27,statLabelX:24,statLabelY:39,statValueY:91,chartGapAfterStats:150,
        chartDefaultHeight:520,chartPrivateHeight:610,chartNoQrExtra:32,chartRadius:36,chartTitleX:104,chartTitleY:54,chartBoundsX:104,chartBoundsY:66,chartBoundsWidth:872,chartBoundsBottom:92,
        statusGap:24,statusHeight:112,statusRadius:28,statusTextX:104,statusTitleY:48,statusNoteY:82,footerGap:146,brandTitleY:40,brandTaglineY:78,brandUrlY:118,legalY:1368,
        qrX:798,qrSize:210,qrRadius:25,qrInset:12,qrImageSize:186,qrCaptionX:903,qrCaptionY:236,
        glowX:925,glowY:90,glowInner:10,glowOuter:420,glowFillX:500,glowFillWidth:580,glowFillHeight:520,decorEllipseX:914,decorEllipseY:222,decorEllipseRx:154,decorEllipseRy:72,decorEllipseRotation:-.25,motherImageX:818,motherImageY:-4,motherImageWidth:210,motherImageHeight:315,motherX:864,motherY:54,motherScale:.78,heartX:812,heartY:88,heartSize:16,smallHeartX:1012,smallHeartY:196,smallHeartSize:10,
        underlineStartX:72,underlineControl1X:154,underlineControl2X:225,underlineEndX:318,underlineEndY:176,underlineWidth:9
      },
      chart:{padLeft:62,padRight:22,padTop:70,padBottom:54,legendY:31,legendDotRadius:6,legendTextX:23,legendRangeX1:150,legendRangeX2:190,legendRangeTextX:202,legendFont:20,axisFont:18,rangeWidth:4,actualWidth:5,currentLineWidth:2,pointOuter:8,pointInner:5,currentOuter:13,currentInner:6,generalDash:[10,8],estimatedDash:[11,9],currentDash:[6,8],axisLabelOffset:13,xLabelY:16,unitY:40,minSpan:8,yMargin:1,fallbackMin:45,fallbackMax:75}
    }
  });
  const query=window.matchMedia('(prefers-color-scheme: dark)');
  const kebab=value=>value.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`);
  function applyUi(){
    const colors=query.matches?design.ui.dark:design.ui.light;
    const root=document.documentElement.style;
    Object.entries(colors).forEach(([key,value])=>root.setProperty(`--share-${kebab(key)}`,value));
    ['space','radius','type','motion','shadow'].forEach(group=>Object.entries(design.ui[group]).forEach(([key,value])=>root.setProperty(`--share-${group}-${kebab(key)}`,value)));
    Object.entries(design.ui.component).forEach(([key,value])=>root.setProperty(`--share-${kebab(key)}`,value));
  }
  applyUi();query.addEventListener?.('change',applyUi);
  window.PregnancyShareDesign=design;
})();
