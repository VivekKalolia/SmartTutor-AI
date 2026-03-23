import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { error: "Missing required parameter: studentId" },
        { status: 400 }
      );
    }

    // Return mock mastery levels (Python service not available)
    const mockMasteryLevels = {
      algebra: 0.75,
      calculus: 0.68,
      geometry: 0.72,
      arithmetic: 0.85,
    };

    return NextResponse.json(mockMasteryLevels);
  } catch (error) {
    console.error("Error in mastery endpoint:", error);
    return NextResponse.json(
      { error: "Failed to get mastery levels", details: String(error) },
      { status: 500 }
    );
  }
}
