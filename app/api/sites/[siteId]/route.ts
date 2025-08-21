import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { withSiteAccess } from '../../../../lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const siteId = parseInt(params.siteId);
  
  return withSiteAccess(request, siteId, 'view', async (req) => {
    try {
      // Get site information
      const { data: site, error: siteError } = await supabaseAdmin
        .from('sites')
        .select(`
          *,
          customers (
            id,
            uuid,
            name
          )
        `)
        .eq('id', siteId)
        .single();
      
      if (siteError || !site) {
        return NextResponse.json(
          { error: 'Site not found' },
          { status: 404 }
        );
      }
      
      // Get nodes for this site
      const { data: nodes, error: nodesError } = await supabaseAdmin
        .from('nodes')
        .select('*')
        .eq('site_id', siteId)
        .order('name', { ascending: true });
      
      if (nodesError) {
        console.error('Failed to fetch nodes:', nodesError);
      }
      
      // Format site response
      const siteData = {
        ...site,
        customer_name: site.customers?.name || 'Unknown'
      };
      
      return NextResponse.json({
        site: siteData,
        nodes: nodes || []
      });
      
    } catch (error) {
      console.error('Failed to fetch site:', error);
      return NextResponse.json(
        { error: 'Failed to fetch site' },
        { status: 500 }
      );
    }
  });
}