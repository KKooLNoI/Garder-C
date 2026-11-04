#include <stdio.h>
int main(void){
long long n,r=0;scanf("%lld",&n);while(n>0){r=r*10+n%10;n/=10;}printf("%lld\n",r);
return 0;}
