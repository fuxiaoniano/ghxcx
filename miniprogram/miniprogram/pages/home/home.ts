import { EnterpriseHome, getEnterpriseHome } from '../../api/enterprise';

Page({
  data:{loading:true,home:{config:{hospitalName:'官方口腔医院',slogan:'专业口腔诊疗服务',logo:'',customerServicePath:''},banners:[],ads:[],categories:[],doctors:[]} as EnterpriseHome},
  onLoad(){this.load();},onPullDownRefresh(){this.load().finally(()=>wx.stopPullDownRefresh());},
  async load(){try{this.setData({loading:true});this.setData({home:await getEnterpriseHome()});}catch(error){wx.showToast({title:error instanceof Error?error.message:'首页加载失败',icon:'none'});}finally{this.setData({loading:false});}},
  openCategory(event:WechatMiniprogram.TouchEvent){wx.setStorageSync('bookingPreset',{categoryId:event.currentTarget.dataset.id});wx.switchTab({url:'/pages/booking/booking'});},
  openDoctor(event:WechatMiniprogram.TouchEvent){wx.navigateTo({url:`/pages/doctor-detail/doctor-detail?id=${event.currentTarget.dataset.id}`});},
  bookDoctor(event:WechatMiniprogram.TouchEvent){wx.navigateTo({url:`/pages/booking-form/booking-form?doctorId=${event.currentTarget.dataset.id}`});},
  openBanner(event:WechatMiniprogram.TouchEvent){const item=this.data.home.banners[Number(event.currentTarget.dataset.index)];if(!item?.linkValue)return;if(item.linkType==='PAGE'){const tabs=['/pages/home/home','/pages/doctors/doctors','/pages/booking/booking','/pages/packages/packages','/pages/profile/profile'];tabs.includes(item.linkValue)?wx.switchTab({url:item.linkValue}):wx.navigateTo({url:item.linkValue});}},
  goBooking(){wx.switchTab({url:'/pages/booking/booking'});},goDoctors(){wx.switchTab({url:'/pages/doctors/doctors'});}
});
