# 🚀 GitHub 자동 배포 설정 가이드

## 1. GitHub 저장소 생성

### 방법 1: GitHub 웹사이트에서 생성
1. [github.com](https://github.com)에 로그인
2. "New repository" 클릭
3. Repository name: `english-learning-app`
4. Description: `AI-powered English learning app with object detection`
5. Public으로 설정 (무료 배포를 위해)
6. "Create repository" 클릭

### 방법 2: GitHub CLI 사용 (설치된 경우)
```bash
gh repo create english-learning-app --public --description "AI-powered English learning app with object detection"
```

## 2. 로컬 저장소와 GitHub 연결

```bash
# 원격 저장소 추가
git remote add origin https://github.com/YOUR_USERNAME/english-learning-app.git

# 메인 브랜치로 푸시
git branch -M main
git push -u origin main
```

## 3. 자동 배포 설정

### Netlify 자동 배포 (추천)
1. [netlify.com](https://netlify.com)에 로그인
2. "New site from Git" 클릭
3. GitHub 선택 및 저장소 연결
4. 빌드 설정:
   - Build command: `npm run build`
   - Publish directory: `build`
5. "Deploy site" 클릭

### Vercel 자동 배포
1. [vercel.com](https://vercel.com)에 로그인
2. "New Project" 클릭
3. GitHub 저장소 import
4. 자동으로 React 앱 감지
5. "Deploy" 클릭

### GitHub Pages 자동 배포
1. 저장소 Settings → Pages
2. Source: "GitHub Actions" 선택
3. 아래 워크플로우 파일 생성

## 4. GitHub Actions 워크플로우 (GitHub Pages용)

`.github/workflows/deploy.yml` 파일 생성:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      if: github.ref == 'refs/heads/main'
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./build
```

## 5. 환경 변수 설정 (필요시)

### Netlify
- Site settings → Environment variables
- `NODE_VERSION`: `18`

### Vercel
- Project settings → Environment Variables
- `NODE_VERSION`: `18`

## 6. 커스텀 도메인 설정 (선택사항)

### Netlify
- Site settings → Domain management
- "Add custom domain" 클릭
- 도메인 입력 및 DNS 설정

### Vercel
- Project settings → Domains
- 도메인 추가 및 DNS 설정

## 7. 배포 확인

배포 후 확인사항:
- [ ] HTTPS가 활성화되어 있는지 확인
- [ ] 카메라 권한 요청이 정상 작동하는지 확인
- [ ] 객체 감지가 정상 작동하는지 확인
- [ ] 모바일에서 정상 작동하는지 확인

## 8. 자동 배포 트리거

이제 코드를 푸시할 때마다 자동으로 배포됩니다:

```bash
# 코드 수정 후
git add .
git commit -m "Update: 설명"
git push origin main
```

## 9. 문제 해결

### 빌드 실패
- GitHub Actions 로그 확인
- 로컬에서 `npm run build` 테스트
- 의존성 문제 확인

### 배포 실패
- 환경 변수 설정 확인
- 빌드 명령어 확인
- 퍼블리시 디렉토리 확인

### 카메라 접근 오류
- HTTPS 확인 (필수)
- 브라우저 권한 확인
- 도메인 설정 확인