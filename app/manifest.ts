import type { MetadataRoute } from "next";

// PWA 매니페스트. 홈 화면에 추가했을 때 브라우저 주소창 없이 앱처럼(standalone) 뜨게 하고,
// 실행 시작 주소를 "/"로 고정해 항상 auth()+todayStr() 리다이렉트를 거쳐 오늘 날짜로 열리게 한다.
// (기존에 추가된 홈 화면 아이콘은 추가 당시 상태로 고정돼 있으므로, 이 파일 배포 후
// 홈 화면에서 삭제하고 Safari에서 다시 "홈 화면에 추가"해야 반영된다.)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "toDo",
    short_name: "toDo",
    description: "매일의 할 일과 반복 루틴을 관리하는 개인용 ToDo 앱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
