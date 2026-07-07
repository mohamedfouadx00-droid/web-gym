import {Dumbbell,Home,MoreHorizontal,TrendingUp,Utensils} from 'lucide-react'
import {NavLink,Outlet} from 'react-router-dom'
const nav=[['/','الرئيسية',Home],['/workout','التمرين',Dumbbell],['/progress','التقدم',TrendingUp],['/nutrition','التغذية',Utensils],['/more','المزيد',MoreHorizontal]] as const
export default function Shell(){return <div className="app-shell"><main className="content"><Outlet/></main><nav className="bottom-nav">{nav.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/'}><Icon size={21}/><span>{label}</span></NavLink>)}</nav></div>}
