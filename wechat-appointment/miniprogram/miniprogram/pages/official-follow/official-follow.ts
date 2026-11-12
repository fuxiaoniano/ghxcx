Page({
  data:{officialAccountName:'傅小念口腔',componentError:false},
  onLoad(options:Record<string,string|undefined>){
    let officialAccountName='傅小念口腔';
    try{officialAccountName=options.name?decodeURIComponent(options.name):officialAccountName;}catch{}
    this.setData({officialAccountName});
  },
  onOfficialAccountLoad(){this.setData({componentError:false});},
  /** 非扫码等受限场景下，原生关注组件可能无法展示，给出可执行的降级指引。 */
  onOfficialAccountError(){this.setData({componentError:true});}
});
