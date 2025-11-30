import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Tooltip, Badge, Dropdown } from 'antd';
import { 
  ProjectOutlined,
  CodeOutlined,
  BookOutlined,
  MenuFoldOutlined, 
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  UnorderedListOutlined,
  ExperimentOutlined,
  ClusterOutlined,
  DownOutlined,
  SettingOutlined,
  BellOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

// 路由配置 - 用于面包屑和菜单
const routeConfig = {
  '/projects': { name: '项目管理', icon: <ProjectOutlined /> },
  '/coding': { name: '编码分析', icon: <CodeOutlined /> },
  '/coding/analysis/results': { name: '分析结果', parent: '/coding' },
  '/code-library': { name: '编码库', icon: <BookOutlined /> },
  '/anti-cheating': { name: '防作弊检测', icon: <SafetyCertificateOutlined /> },
  '/anti-cheating/results': { name: '检测结果', parent: '/anti-cheating' },
  '/workshop/cluster-test': { name: '聚类测试', parent: '/workshop', icon: <ClusterOutlined /> },
  '/system': { name: '系统管理', icon: <SettingOutlined /> },
};

// 获取面包屑
const getBreadcrumbs = (pathname) => {
  // 处理动态路由如 /coding/analysis/results/:taskId
  let matchedPath = pathname;
  if (pathname.startsWith('/coding/analysis/results/')) {
    matchedPath = '/coding/analysis/results';
  }
  
  const route = routeConfig[matchedPath];
  if (!route) {
    // 尝试匹配父级路由
    const segments = pathname.split('/').filter(Boolean);
    for (let i = segments.length; i > 0; i--) {
      const testPath = '/' + segments.slice(0, i).join('/');
      if (routeConfig[testPath]) {
        return [routeConfig[testPath].name];
      }
    }
    return ['首页'];
  }
  
  const breadcrumbs = [route.name];
  if (route.parent && routeConfig[route.parent]) {
    breadcrumbs.unshift(routeConfig[route.parent].name);
  }
  return breadcrumbs;
};

// ==================== Sidebar Component ====================
const Sidebar = ({ collapsed }) => {
  const location = useLocation();
  const { user, hasPermission } = useAuth();
  const [openKeys, setOpenKeys] = useState(() => {
    if (location.pathname.startsWith('/workshop')) return ['workshop'];
    return [];
  });

  // 菜单配置 - 统一管理
  const allMenuItems = [
    { path: '/projects', name: '项目管理', icon: <ProjectOutlined />, permission: '/projects' },
    { path: '/coding', name: '编码分析', icon: <CodeOutlined />, permission: '/coding' },
    { path: '/code-library', name: '编码库', icon: <BookOutlined />, permission: '/code-library' },
    { path: '/anti-cheating', name: '防作弊检测', icon: <SafetyCertificateOutlined />, permission: '/anti-cheating' },
    { 
      key: 'workshop',
      name: '测试工坊', 
      icon: <ExperimentOutlined />,
      permission: '/workshop',
      children: [
        { path: '/workshop/cluster-test', name: '聚类测试', icon: <ClusterOutlined />, permission: '/workshop/cluster-test' },
      ]
    },
    { path: '/system', name: '系统管理', icon: <SettingOutlined />, permission: '/system' },
  ];

  // 根据权限过滤菜单项
  const menuItems = allMenuItems.filter(item => {
    if (user?.is_superuser) return true; // 超级管理员显示所有菜单
    if (item.children) {
      // 子菜单：过滤子项，如果有可访问的子项则显示
      item.children = item.children.filter(child => hasPermission(child.permission));
      return item.children.length > 0;
    }
    return hasPermission(item.permission);
  });

  const toggleSubmenu = (key) => {
    setOpenKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const isActive = (path) => {
    if (path === '/coding') return location.pathname === '/coding';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isGroupActive = (item) => {
    if (!item.children) return false;
    return item.children.some(child => isActive(child.path));
  };

  // 菜单项组件
  const MenuItem = ({ item, indent = false }) => {
    const active = isActive(item.path);
    
    const content = (
      <NavLink
        to={item.path}
        className={`
          group relative flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg
          transition-all duration-200 ease-out
          ${active 
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }
          ${indent ? 'ml-4' : ''}
          ${collapsed ? 'justify-center mx-1 px-2' : ''}
        `}
      >
        {active && !collapsed && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full" />
        )}
        <span className={`text-lg flex-shrink-0 transition-transform duration-200 ${active ? '' : 'group-hover:scale-110'}`}>
          {item.icon}
        </span>
        {!collapsed && (
          <>
            <span className="text-sm font-medium flex-1 truncate">{item.name}</span>
            {item.badge > 0 && <Badge count={item.badge} size="small" />}
          </>
        )}
      </NavLink>
    );

    return collapsed ? (
      <Tooltip title={item.name} placement="right" mouseEnterDelay={0.1}>{content}</Tooltip>
    ) : content;
  };

  // 子菜单组件
  const SubMenu = ({ item }) => {
    const isOpen = openKeys.includes(item.key);
    const active = isGroupActive(item);

    if (collapsed) {
      return (
        <Tooltip title={item.name} placement="right" mouseEnterDelay={0.1}>
          <NavLink
            to={item.children[0]?.path || '#'}
            className={`
              flex items-center justify-center py-2.5 mx-1 rounded-lg transition-all duration-200
              ${active 
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
                : 'text-slate-600 hover:bg-slate-100'
              }
            `}
          >
            <span className="text-lg">{item.icon}</span>
          </NavLink>
        </Tooltip>
      );
    }

    return (
      <div>
        <button
          onClick={() => toggleSubmenu(item.key)}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg
            transition-all duration-200 ease-out text-left
            ${active ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-100'}
          `}
          style={{ width: 'calc(100% - 16px)' }}
        >
          <span className={`text-lg ${active ? 'text-blue-500' : 'text-slate-400'}`}>{item.icon}</span>
          <span className="text-sm font-medium flex-1">{item.name}</span>
          <DownOutlined className={`text-xs text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="py-1 space-y-0.5">
            {item.children.map(child => <MenuItem key={child.path} item={child} indent />)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className={`
      fixed left-0 top-0 h-screen z-40 bg-white border-r border-slate-200/80
      flex flex-col transition-all duration-300 ease-out
      ${collapsed ? 'w-[72px]' : 'w-60'}
      shadow-[2px_0_8px_-2px_rgba(0,0,0,0.05)]
    `}>
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-slate-100 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30">
              Ai
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">AiCoding</h1>
              <p className="text-[10px] text-slate-400 font-medium">智能编码平台</p>
            </div>
          )}
        </div>
      </div>

      {/* 菜单区域 */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        <div className="space-y-1">
          {menuItems.map(item => 
            item.children ? (
              <SubMenu key={item.key} item={item} />
            ) : (
              <MenuItem key={item.path} item={item} />
            )
          )}
        </div>
      </nav>

      {/* 底部用户区域 */}
      <div className={`border-t border-slate-100 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <Tooltip title="设置" placement="right">
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
              <SettingOutlined className="text-lg" />
            </button>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-xs font-medium shadow-sm">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{user?.username || '用户名'}</p>
              <p className="text-[10px] text-slate-400">{user?.is_superuser ? '超级管理员' : '普通用户'}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

// ==================== Header Component ====================
const Header = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick = ({ key }) => {
    switch (key) {
      case 'profile':
        // 跳转到个人信息页面
        navigate('/profile');
        break;
      case 'system':
        // 跳转到系统管理
        navigate('/system');
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        break;
    }
  };

  const userMenuItems = [
    {
      key: 'user-info',
      type: 'group',
      label: (
        <div className="px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-medium text-gray-800">{user?.username || '用户'}</p>
              <p className="text-xs text-gray-500">
                {user?.email || '未设置邮箱'}
              </p>
            </div>
          </div>
          {user?.is_superuser && (
            <div className="mt-2 px-2">
              <span className="inline-block px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded">
                超级管理员
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    ...(user?.is_superuser ? [{
      key: 'system',
      icon: <SettingOutlined />,
      label: '系统管理',
    }] : []),
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  return (
    <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 sticky top-0 z-30 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggle}
          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 active:scale-95"
        >
          {collapsed ? <MenuUnfoldOutlined className="text-lg" /> : <MenuFoldOutlined className="text-lg" />}
        </button>
        <div className="hidden md:flex items-center gap-2 text-sm">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="text-slate-300">/</span>}
              <span className={index === breadcrumbs.length - 1 ? 'text-slate-600 font-medium' : 'text-slate-400'}>
                {item}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Tooltip title="通知" placement="bottom">
          <button className="relative w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
            <BellOutlined className="text-lg" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          </button>
        </Tooltip>
        
        <Tooltip title="帮助文档" placement="bottom">
          <button className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
            <QuestionCircleOutlined className="text-lg" />
          </button>
        </Tooltip>

        <div className="w-px h-6 bg-slate-200 mx-1" />
        
        <Dropdown 
          menu={{ items: userMenuItems, onClick: handleMenuClick }} 
          placement="bottomRight" 
          trigger={['click']}
          overlayClassName="user-dropdown"
        >
          <button className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded-lg transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium shadow-sm">
              {user?.username?.[0]?.toUpperCase() || <UserOutlined />}
            </div>
          </button>
        </Dropdown>
      </div>
    </header>
  );
};

// ==================== MainLayout Component ====================
const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar collapsed={collapsed} />
      <div className={`flex flex-col min-h-screen transition-all duration-300 ease-out ${collapsed ? 'ml-[72px]' : 'ml-60'}`}>
        <Header collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <main className="flex-1 p-6">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
        <footer className="py-4 px-6 text-center">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} AiCoding Platform · <span className="ml-2">v1.0.0</span>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;
