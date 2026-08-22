Page({
  data:{officialAccountName:'医院公众号',componentError:false},
  onLoad(options:Record<string,string|undefined>){
    this.setData({officialAccountName:options.name?decodeURIComponent(options.name):'医院公众号'});
  },
  onOfficialAccountLoad(){this.setData({componentError:false});},
  /** 非扫码等受限场景下，原生关注组件可能无法展示，给出可执行的降级指引。 */
  onOfficialAccountError(){this.setData({componentError:true});}
});
