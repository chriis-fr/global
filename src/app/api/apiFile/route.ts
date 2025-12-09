import { NextRequest, NextResponse } from 'next/server';

export async function POST(request:NextRequest){
    const body = await request.json()
    try{
        console.log(body)
        return NextResponse.json({
            success:true,
            message:body,
            id:1
        })
    }catch(error){
        console.log(error)
    }

}