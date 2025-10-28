export type PermissionLevel = 'client_view_only' | 'delivery_driver_edit' | 'admin_full_access';

export const hasPermission = (
  userLevel: PermissionLevel | undefined,
  requiredLevel: 'view_confidential' | 'view_amounts' | 'download_docs'
): boolean => {
  const level = userLevel || 'client_view_only';
  
  switch (requiredLevel) {
    case 'view_confidential':
      // Only clients and admins can see emails, phones, addresses
      return level === 'client_view_only' || level === 'admin_full_access';
    
    case 'view_amounts':
      // Only clients and admins can see payment amounts
      return level === 'client_view_only' || level === 'admin_full_access';
    
    case 'download_docs':
      // Only clients and admins can download/view PDFs
      return level === 'client_view_only' || level === 'admin_full_access';
    
    default:
      return false;
  }
};

export const isDeliveryDriver = (level: PermissionLevel | undefined): boolean => {
  return level === 'delivery_driver_edit';
};
