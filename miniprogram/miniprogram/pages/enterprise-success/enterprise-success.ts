import { EnterpriseAppointment } from '../../api/enterprise';
Page({data:{appointment:{} as EnterpriseAppointment},onLoad(){this.setData({appointment:(wx.getStorageSync('enterpriseAppointment')||{}) as EnterpriseAppointment});},goRecords(){wx.switchTab({url:'/pages/profile/profile'});},goHome(){wx.switchTab({url:'/pages/home/home'});}});
