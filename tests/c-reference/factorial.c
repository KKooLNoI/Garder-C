#include <stdio.h>
int main(void){
int n,i;unsigned long long r=1;scanf("%d",&n);for(i=2;i<=n;i++)r*=i;printf("%llu\n",r);
return 0;}
